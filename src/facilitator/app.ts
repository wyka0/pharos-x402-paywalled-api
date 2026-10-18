import { x402Facilitator } from "@x402/core/facilitator";
import type { PaymentPayload, PaymentRequirements, SettleResponse } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";
import type { FacilitatorEvmSigner } from "@x402/evm";
import express, { type NextFunction, type Request, type Response } from "express";
import { consoleLogger, errorMessage, type Logger } from "../logging.js";
import { CHAIN_ID, NETWORK, NETWORK_NAME, USDC_ADDRESS, USDC_DECIMALS } from "../network.js";
import { SettlementLedger, settlementKey } from "./ledger.js";
import {
  parseFacilitatorRequest,
  precheckRequirements,
  type ParsedFacilitatorRequest,
} from "./validation.js";

export interface FacilitatorAppOptions {
  signer: FacilitatorEvmSigner;
  logger?: Logger;
  ledger?: SettlementLedger;
}

function rejectVerify(res: Response, reason: string, message: string): void {
  res.status(200).json({
    isValid: false,
    invalidReason: reason,
    invalidMessage: message,
  });
}

function rejectSettle(
  res: Response,
  requirements: PaymentRequirements,
  reason: string,
  message: string,
): void {
  const response: SettleResponse = {
    success: false,
    transaction: "",
    network: requirements.network,
    errorReason: reason,
    errorMessage: message,
  };
  res.status(200).json(response);
}

/**
 * Self-hosted x402 facilitator using the official @x402/core facilitator
 * interfaces and @x402/evm exact scheme. It never reports success unless the
 * EVM scheme actually broadcasts and confirms a transferWithAuthorization.
 */
export function createFacilitatorApp(options: FacilitatorAppOptions): express.Express {
  const logger = options.logger ?? consoleLogger;
  const ledger = options.ledger ?? new SettlementLedger();
  const facilitator = new x402Facilitator();
  facilitator.register(NETWORK, new ExactEvmScheme(options.signer));

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb", strict: true }));

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service: "pharos-x402-facilitator",
      network: NETWORK,
      networkName: NETWORK_NAME,
      chainId: CHAIN_ID,
      scheme: "exact",
      asset: USDC_ADDRESS,
      assetDecimals: USDC_DECIMALS,
      signers: [...options.signer.getAddresses()],
      cachedSettlements: ledger.cachedSettlementCount,
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/supported", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(facilitator.getSupported());
  });

  app.post("/verify", async (req: Request, res: Response) => {
    const parsed = parseFacilitatorRequest(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: "invalid_request", details: parsed.issues });
      return;
    }

    const { paymentPayload, paymentRequirements } = parsed.value;
    const precheck = precheckRequirements(paymentRequirements);
    if (!precheck.ok) {
      rejectVerify(res, precheck.reason, precheck.message);
      return;
    }

    try {
      const result = await facilitator.verify(paymentPayload, paymentRequirements);
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json(result);
    } catch (error) {
      logger.error("facilitator verify failed", {
        operation: "verify",
        message: errorMessage(error),
      });
      res.status(500).json({
        error: "facilitator_error",
        message: "Facilitator verification failed due to an internal error.",
      });
    }
  });

  app.post("/settle", async (req: Request, res: Response) => {
    const parsed = parseFacilitatorRequest(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: "invalid_request", details: parsed.issues });
      return;
    }

    const { paymentPayload, paymentRequirements } = parsed.value;
    const precheck = precheckRequirements(paymentRequirements);
    if (!precheck.ok) {
      rejectSettle(res, paymentRequirements, precheck.reason, precheck.message);
      return;
    }

    try {
      const key = settlementKey(paymentPayload, paymentRequirements);
      const { response, reused } = await ledger.run(key, () =>
        facilitator.settle(paymentPayload, paymentRequirements),
      );
      res.setHeader("Cache-Control", "no-store");
      if (reused) {
        res.setHeader("X-X402-Settlement-Reused", "true");
      }
      res.status(200).json(response);
    } catch (error) {
      logger.error("facilitator settle failed", {
        operation: "settle",
        message: errorMessage(error),
      });
      res.status(500).json({
        error: "facilitator_error",
        message: "Facilitator settlement failed due to an internal error.",
      });
    }
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "not_found" });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    void _next;
    if (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      (error as { type?: unknown }).type === "entity.parse.failed"
    ) {
      res.status(400).json({
        error: "invalid_json",
        message: "Request body must be valid JSON.",
      });
      return;
    }
    logger.error("unhandled facilitator error", { message: errorMessage(error) });
    res.status(500).json({
      error: "internal_error",
      message: "Unexpected facilitator error.",
    });
  });

  app.locals.facilitator = facilitator;
  app.locals.ledger = ledger;
  return app;
}

export type FacilitatorRequest = ParsedFacilitatorRequest;
export type { PaymentPayload, PaymentRequirements };
