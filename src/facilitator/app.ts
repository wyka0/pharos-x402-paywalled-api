import { x402Facilitator } from "@x402/core/facilitator";
import type { PaymentPayload, PaymentRequirements, SettleResponse } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";
import type { FacilitatorEvmSigner } from "@x402/evm";
import express, { type NextFunction, type Request, type Response } from "express";
import { consoleLogger, errorMessage, type Logger } from "../logging.js";
import { CHAIN_ID, NETWORK, NETWORK_NAME, USDC_ADDRESS, USDC_DECIMALS } from "../network.js";
import { SettlementLedger, settlementKey } from "./ledger.js";
import { FixedWindowRateLimiter } from "./rate-limit.js";
import {
  parseFacilitatorRequest,
  precheckRequirements,
  type ParsedFacilitatorRequest,
} from "./validation.js";

export interface FacilitatorRateLimitOptions {
  /** Defaults to true. */
  enabled?: boolean;
  /** Per-client POST /verify attempts per 60-second window. Default 120. */
  verifyPerMinute?: number;
  /** Per-client POST /settle attempts per 60-second window. Default 30. */
  settlePerMinute?: number;
  /** Maximum concurrent POST /settle requests in this process. Default 2. */
  maxConcurrentSettlements?: number;
  /** Test hook; production uses a 60-second window. */
  windowMs?: number;
  /** Test hook; production uses Date.now. */
  now?: () => number;
}

export interface FacilitatorAppOptions {
  signer: FacilitatorEvmSigner;
  logger?: Logger;
  ledger?: SettlementLedger;
  /**
   * Number of trusted reverse-proxy hops. 0 (the default) ignores
   * X-Forwarded-For and is the safe initial setting; a positive number trusts
   * exactly that many hops and must match the verified proxy chain.
   */
  trustProxyHops?: number;
  rateLimit?: FacilitatorRateLimitOptions;
}

interface ResolvedRateLimitOptions {
  enabled: boolean;
  verifyPerMinute: number;
  settlePerMinute: number;
  maxConcurrentSettlements: number;
  windowMs: number;
  now: () => number;
}

function resolveRateLimitOptions(
  options: FacilitatorRateLimitOptions | undefined,
): ResolvedRateLimitOptions {
  return {
    enabled: options?.enabled ?? true,
    verifyPerMinute: options?.verifyPerMinute ?? 120,
    settlePerMinute: options?.settlePerMinute ?? 30,
    maxConcurrentSettlements: options?.maxConcurrentSettlements ?? 2,
    windowMs: options?.windowMs ?? 60_000,
    now: options?.now ?? Date.now,
  };
}

/**
 * Express matches routes case-insensitively and permits a trailing slash by
 * default, so normalize both before selecting a limiter; otherwise /VERIFY/ or
 * /verify/ would bypass the budget.
 */
function normalizedPostPath(req: Request): string {
  const path = req.path.toLowerCase().replace(/\/+$/, "");
  return path.length > 0 ? path : "/";
}

function isPost(req: Request): boolean {
  // Express matches methods case-insensitively; normalize before deciding
  // whether a request is in scope for the limiter.
  return req.method.toUpperCase() === "POST";
}

function rateLimitKey(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function rejectRateLimited(res: Response, retryAfterSeconds: number, message?: string): void {
  res.setHeader("Retry-After", String(Math.max(1, Math.ceil(retryAfterSeconds))));
  res.setHeader("Cache-Control", "no-store");
  res.status(429).json({
    error: "rate_limited",
    message: message ?? "Too many requests. Retry after the indicated delay.",
  });
}

function bodyParserErrorType(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("type" in error)) {
    return undefined;
  }
  const type = (error as { type?: unknown }).type;
  return typeof type === "string" ? type : undefined;
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
  // Numeric trust proxy: 0 ignores client-supplied X-Forwarded-For entirely;
  // N trusts exactly N reverse-proxy hops. Never pass a boolean here, because
  // that would trust the leftmost, client-controlled address.
  app.set("trust proxy", options.trustProxyHops ?? 0);

  const limits = resolveRateLimitOptions(options.rateLimit);
  if (limits.enabled) {
    const verifyLimiter = new FixedWindowRateLimiter(
      limits.verifyPerMinute,
      limits.windowMs,
      limits.now,
    );
    const settleLimiter = new FixedWindowRateLimiter(
      limits.settlePerMinute,
      limits.windowMs,
      limits.now,
    );

    // Run before JSON parsing so rejected attempts cost little. Verify and
    // settle have separate budgets: a payment needs one of each.
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (!isPost(req)) {
        next();
        return;
      }
      const path = normalizedPostPath(req);
      const limiter =
        path === "/verify" ? verifyLimiter : path === "/settle" ? settleLimiter : undefined;
      if (limiter === undefined) {
        next();
        return;
      }
      const decision = limiter.check(rateLimitKey(req));
      if (!decision.allowed) {
        rejectRateLimited(res, decision.retryAfterSeconds);
        return;
      }
      next();
    });

    // Bound in-flight settlements in this single-replica process to avoid
    // nonce/RPC bursts. The settlement ledger still provides idempotency.
    let inFlightSettlements = 0;
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (!isPost(req) || normalizedPostPath(req) !== "/settle") {
        next();
        return;
      }
      if (inFlightSettlements >= limits.maxConcurrentSettlements) {
        rejectRateLimited(res, 1, "Too many concurrent settlements. Retry shortly.");
        return;
      }
      inFlightSettlements += 1;
      let released = false;
      const release = (): void => {
        if (released) return;
        released = true;
        inFlightSettlements -= 1;
      };
      res.once("finish", release);
      res.once("close", release);
      next();
    });
  }

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
    const bodyErrorType = bodyParserErrorType(error);
    if (bodyErrorType === "entity.parse.failed") {
      res.status(400).json({
        error: "invalid_json",
        message: "Request body must be valid JSON.",
      });
      return;
    }
    if (bodyErrorType === "entity.too.large") {
      res.status(413).json({
        error: "payload_too_large",
        message: "Request body exceeds the 256 KB limit.",
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
