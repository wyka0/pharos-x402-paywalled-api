import { timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { runPaymentFlow, type PaymentFlowResult } from "../client/flow.js";
import {
  assertLivePaymentApproved,
  ConfigError,
  loadPayerConfig,
  type PayerConfig,
  type ResourceConfig,
} from "../config.js";
import { errorMessage, type Logger, consoleLogger } from "../logging.js";
import { NETWORK, USDC_ADDRESS } from "../network.js";

export interface PaymentDemoDependencies {
  runFlow?: typeof runPaymentFlow;
  resolvePayer?: () => PayerConfig;
  logger?: Logger;
  now?: () => number;
}

const DEFAULT_COOLDOWN_MS = 3_000;

function tokensMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function notConfigured(res: Response): void {
  res.status(503).json({
    status: "not_configured",
    message:
      "The live payment demo is disabled on this server. Nothing was signed and nothing was broadcast.",
    required: [
      "PAYMENT_DEMO_ENABLED=YES",
      "PAYMENT_DEMO_APPROVAL_TOKEN=<random, at least 16 characters>",
      "LIVE_PAYMENT_APPROVED=YES",
      "PAYER_PRIVATE_KEY or PAYER_PRIVATE_KEY_FILE (server-side only)",
      "facilitator signer funded with PHRS for gas",
    ],
  });
}

/**
 * Additive, opt-in server-side payment demo.
 *
 * The browser submits only a route, a confirmation flag, and a manual approval
 * token. The private key stays in the Express process. The endpoint is disabled
 * unless both PAYMENT_DEMO_ENABLED=YES and LIVE_PAYMENT_APPROVED=YES are set,
 * and it never fabricates a receipt.
 */
export function createPaymentDemoRouter(
  config: ResourceConfig,
  deps: PaymentDemoDependencies = {},
): Router {
  const router = Router();
  const logger = deps.logger ?? consoleLogger;
  const runFlow = deps.runFlow ?? runPaymentFlow;
  const resolvePayer = deps.resolvePayer ?? (() => loadPayerConfig());
  const now = deps.now ?? (() => Date.now());
  const approvalToken = config.paymentDemoApprovalToken ?? "";
  const enabled = config.paymentDemoEnabled === true && approvalToken.length > 0;
  const apiUrl = config.paymentDemoApiUrl ?? `http://127.0.0.1:${config.port}`;

  let inFlight = false;
  let lastSettlementAt = 0;

  router.post("/payment", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");

    if (!enabled) {
      notConfigured(res);
      return;
    }

    const providedToken = req.header("x-payment-demo-token") ?? "";
    if (!tokensMatch(providedToken, approvalToken)) {
      res.status(403).json({
        status: "approval_required",
        message: "The server approval token is missing or incorrect. Nothing was signed.",
      });
      return;
    }

    const body = req.body as { route?: unknown; confirm?: unknown } | undefined;
    const route = body?.route;
    if (route !== "/data" && route !== "/api/info") {
      res.status(400).json({
        status: "failed",
        message: "route must be /data or /api/info",
      });
      return;
    }
    if (body?.confirm !== true) {
      res.status(400).json({
        status: "confirmation_required",
        message: "Explicit confirmation is required before a testnet payment can run.",
      });
      return;
    }

    if (inFlight) {
      res.status(409).json({
        status: "busy",
        message: "A payment demo is already running. Nothing else was signed.",
      });
      return;
    }

    if (lastSettlementAt > 0 && now() - lastSettlementAt < DEFAULT_COOLDOWN_MS) {
      res.status(429).json({
        status: "busy",
        message: "A settlement just completed. Wait a few seconds before trying again.",
      });
      return;
    }

    let payer: PayerConfig;
    try {
      payer = resolvePayer();
      assertLivePaymentApproved(payer);
    } catch (error) {
      logger.warn("payment demo blocked by configuration", {
        message: errorMessage(error),
      });
      res.status(503).json({
        status: "not_configured",
        message:
          "The payment demo is enabled but incomplete. Nothing was signed and nothing was broadcast.",
        required:
          error instanceof ConfigError
            ? error.issues
            : ["a valid server-side payer key and LIVE_PAYMENT_APPROVED=YES"],
      });
      return;
    }

    inFlight = true;
    try {
      const result: PaymentFlowResult = await runFlow({
        apiUrl,
        route,
        payerPrivateKey: payer.privateKey,
        rpcUrl: payer.rpcUrl,
        mode: "live",
        log: () => undefined,
      });

      if (
        result.mode !== "live" ||
        !result.settlement.success ||
        !result.receipt ||
        !result.explorerUrl
      ) {
        throw new Error(
          "The payment flow did not return a confirmed live receipt. No settlement is claimed.",
        );
      }

      lastSettlementAt = now();
      logger.info("payment demo settled", {
        route: result.route,
        network: result.settlement.network,
        asset: USDC_ADDRESS,
        amountAtomic: result.accepted.amount,
        transaction: result.settlement.transaction,
        blockNumber: result.receipt.blockNumber,
      });

      res.status(200).json({
        status: "settled",
        route: result.route,
        network: result.settlement.network ?? NETWORK,
        payer: result.payer,
        amountAtomic: result.accepted.amount,
        responseStatus: result.responseStatus,
        responseBody: result.responseBody,
        settlement: result.settlement,
        receipt: result.receipt,
        explorerUrl: result.explorerUrl,
        settledAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("payment demo failed", {
        route,
        message: errorMessage(error),
      });
      res.status(502).json({
        status: "failed",
        message: `The live payment did not settle: ${errorMessage(error)}`,
      });
    } finally {
      inFlight = false;
    }
  });

  return router;
}
