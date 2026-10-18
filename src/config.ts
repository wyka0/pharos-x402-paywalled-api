import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import {
  CHAIN_ID,
  DEFAULT_RPC_URL,
  NETWORK,
  USDC_ADDRESS,
  USDC_DECIMALS,
  USDC_NAME,
  USDC_VERSION,
} from "./network.js";

export type Env = Record<string, string | undefined>;

/**
 * Configuration error that is safe to print: it contains variable names and
 * problem descriptions, never secret values.
 */
export class ConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid configuration:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
    this.name = "ConfigError";
    this.issues = issues;
  }
}

export interface ResourceConfig {
  readonly payTo: Address;
  readonly facilitatorUrl: string;
  readonly port: number;
  readonly trustProxy: boolean;
  readonly facilitatorTimeoutMs: number;
  /**
   * Opt-in server-side payment demo. Disabled unless explicitly enabled.
   * The approval token is not a signing key; it is a second, manual gate.
   */
  readonly paymentDemoEnabled?: boolean;
  readonly paymentDemoApprovalToken?: string;
  readonly paymentDemoApiUrl?: string;
}

export interface FacilitatorConfig {
  readonly privateKey: Hex;
  readonly rpcUrl: string;
  readonly port: number;
  readonly confirmationTimeoutMs: number;
}

export interface PayerConfig {
  readonly privateKey: Hex;
  readonly apiUrl: string;
  readonly route: string;
  readonly rpcUrl: string;
  readonly livePaymentApproved: boolean;
}

function readOptional(env: Env, name: string): string | undefined {
  const value = env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parsePort(env: Env, name: string, fallback: number, issues: string[]): number {
  const raw = readOptional(env, name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    issues.push(`${name}: must be an integer between 1 and 65535`);
    return fallback;
  }
  return value;
}

function parsePositiveInteger(
  env: Env,
  name: string,
  fallback: number,
  issues: string[],
  max = 2_147_483_647,
): number {
  const raw = readOptional(env, name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > max) {
    issues.push(`${name}: must be a positive integer no greater than ${max}`);
    return fallback;
  }
  return value;
}

function parseBoolean(env: Env, name: string, fallback: boolean, issues: string[]): boolean {
  const raw = readOptional(env, name)?.toLowerCase();
  if (raw === undefined) return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  issues.push(`${name}: must be one of true/false/1/0/yes/no`);
  return fallback;
}

function parseAddress(value: string | undefined, name: string, issues: string[]): Address | undefined {
  if (value === undefined) {
    issues.push(`${name}: is required`);
    return undefined;
  }
  if (!isAddress(value)) {
    issues.push(`${name}: must be a 20-byte hex address`);
    return undefined;
  }
  const address = getAddress(value);
  if (address === "0x0000000000000000000000000000000000000000") {
    issues.push(`${name}: must not be the zero address`);
    return undefined;
  }
  return address;
}

function parseHttpUrl(
  value: string | undefined,
  name: string,
  fallback: string | undefined,
  issues: string[],
): string {
  const candidate = value ?? fallback;
  if (candidate === undefined) {
    issues.push(`${name}: is required`);
    return "";
  }
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      issues.push(`${name}: must use http or https`);
      return "";
    }
    if (url.username || url.password) {
      issues.push(`${name}: must not contain credentials`);
      return "";
    }
    return candidate.replace(/\/+$/, "");
  } catch {
    issues.push(`${name}: must be a valid absolute http(s) URL`);
    return "";
  }
}

/**
 * Guard against accidentally running on mainnet or with a substituted token.
 * Any explicitly supplied value must match the verified Atlantic configuration.
 */
function assertNetworkConsistency(env: Env, issues: string[]): void {
  const expected: Array<[string, string]> = [
    ["NETWORK", NETWORK],
    ["CHAIN_ID", String(CHAIN_ID)],
    ["USDC_ADDRESS", USDC_ADDRESS],
    ["USDC_DECIMALS", String(USDC_DECIMALS)],
    ["USDC_NAME", USDC_NAME],
    ["USDC_VERSION", USDC_VERSION],
  ];

  for (const [name, value] of expected) {
    const provided = readOptional(env, name);
    if (provided === undefined) continue;
    if (name === "USDC_ADDRESS") {
      if (!isAddress(provided) || getAddress(provided) !== getAddress(USDC_ADDRESS)) {
        issues.push(`${name}: must be the verified Atlantic USDC address ${USDC_ADDRESS}`);
      }
      continue;
    }
    if (provided !== value) {
      issues.push(`${name}: must be "${value}" (Pharos Atlantic Testnet); mainnet and other networks are not supported`);
    }
  }
}

function readPrivateKey(
  env: Env,
  keyVar: string,
  fileVar: string,
  label: string,
  issues: string[],
): Hex | undefined {
  const inline = readOptional(env, keyVar);
  const filePath = readOptional(env, fileVar);

  if (inline !== undefined && filePath !== undefined) {
    issues.push(`${label}: set only one of ${keyVar} or ${fileVar}, not both`);
    return undefined;
  }
  if (inline === undefined && filePath === undefined) {
    issues.push(`${label}: set ${keyVar} or ${fileVar}`);
    return undefined;
  }

  let value: string;
  if (inline !== undefined) {
    value = inline;
  } else {
    const absolutePath = resolve(process.cwd(), filePath as string);
    try {
      value = readFileSync(absolutePath, "utf8").trim();
    } catch {
      issues.push(`${label}: could not read ${fileVar} at ${absolutePath}`);
      return undefined;
    }
    if (value.length === 0) {
      issues.push(`${label}: ${fileVar} is empty`);
      return undefined;
    }
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    // Deliberately does not echo the value.
    issues.push(`${label}: private key must be exactly 32 bytes of hex prefixed with 0x`);
    return undefined;
  }
  return value as Hex;
}

/**
 * Load and validate resource API configuration. Throws ConfigError listing every
 * problem instead of silently falling back to a default network or facilitator.
 */
export function loadResourceConfig(env: Env = process.env): ResourceConfig {
  const issues: string[] = [];
  assertNetworkConsistency(env, issues);

  const payTo = parseAddress(readOptional(env, "PAY_TO_ADDRESS"), "PAY_TO_ADDRESS", issues);
  const facilitatorUrl = parseHttpUrl(
    readOptional(env, "FACILITATOR_URL"),
    "FACILITATOR_URL",
    undefined,
    issues,
  );
  const port = parsePort(env, "PORT", 4021, issues);
  const trustProxy = parseBoolean(env, "TRUST_PROXY", false, issues);
  const facilitatorTimeoutMs = parsePositiveInteger(
    env,
    "FACILITATOR_TIMEOUT_MS",
    30_000,
    issues,
  );

  const paymentDemoEnabled = parseBoolean(env, "PAYMENT_DEMO_ENABLED", false, issues);
  const paymentDemoApprovalToken = readOptional(env, "PAYMENT_DEMO_APPROVAL_TOKEN");
  const paymentDemoApiUrl = parseHttpUrl(
    readOptional(env, "PAYMENT_DEMO_API_URL"),
    "PAYMENT_DEMO_API_URL",
    `http://127.0.0.1:${port}`,
    issues,
  );

  if (paymentDemoEnabled) {
    if (paymentDemoApprovalToken === undefined) {
      issues.push(
        "PAYMENT_DEMO_APPROVAL_TOKEN: required when PAYMENT_DEMO_ENABLED=YES (use a random value of at least 16 characters)",
      );
    } else if (paymentDemoApprovalToken.length < 16) {
      issues.push("PAYMENT_DEMO_APPROVAL_TOKEN: must be at least 16 characters");
    }
    if (readOptional(env, "LIVE_PAYMENT_APPROVED")?.toUpperCase() !== "YES") {
      issues.push(
        "LIVE_PAYMENT_APPROVED: must be exactly YES when PAYMENT_DEMO_ENABLED=YES (this is the broadcast approval)",
      );
    }
  }

  if (issues.length > 0 || payTo === undefined) {
    throw new ConfigError(issues);
  }

  return {
    payTo,
    facilitatorUrl,
    port,
    trustProxy,
    facilitatorTimeoutMs,
    paymentDemoEnabled,
    ...(paymentDemoApprovalToken ? { paymentDemoApprovalToken } : {}),
    paymentDemoApiUrl,
  };
}

/**
 * Startup check for the opt-in demo. It requires a valid payer key and the
 * explicit approval flag before the API will expose a payment action. The key
 * remains server-side; only the approval token is ever entered in the browser.
 */
export function assertPaymentDemoReady(
  config: ResourceConfig,
  env: Env = process.env,
): void {
  if (!config.paymentDemoEnabled) {
    return;
  }
  if (!config.paymentDemoApprovalToken) {
    throw new ConfigError([
      "PAYMENT_DEMO_APPROVAL_TOKEN: required when PAYMENT_DEMO_ENABLED=YES",
    ]);
  }
  const payer = loadPayerConfig(env);
  assertLivePaymentApproved(payer);
}

/**
 * Load and validate facilitator configuration. The facilitator needs its own
 * signer because it pays gas to broadcast transferWithAuthorization.
 */
export function loadFacilitatorConfig(env: Env = process.env): FacilitatorConfig {
  const issues: string[] = [];
  assertNetworkConsistency(env, issues);

  const privateKey = readPrivateKey(
    env,
    "FACILITATOR_PRIVATE_KEY",
    "FACILITATOR_PRIVATE_KEY_FILE",
    "facilitator signer",
    issues,
  );
  const rpcUrl = parseHttpUrl(readOptional(env, "RPC_URL"), "RPC_URL", DEFAULT_RPC_URL, issues);
  const port = parsePort(env, "FACILITATOR_PORT", 4022, issues);
  const confirmationTimeoutMs = parsePositiveInteger(
    env,
    "FACILITATOR_CONFIRMATION_TIMEOUT_MS",
    60_000,
    issues,
  );

  if (issues.length > 0 || privateKey === undefined) {
    throw new ConfigError(issues);
  }

  return { privateKey, rpcUrl, port, confirmationTimeoutMs };
}

/**
 * Load payer configuration. Signing is additionally gated by
 * assertLivePaymentApproved() so no transaction is ever sent by accident.
 */
export function loadPayerConfig(env: Env = process.env): PayerConfig {
  const issues: string[] = [];
  assertNetworkConsistency(env, issues);

  const privateKey = readPrivateKey(
    env,
    "PAYER_PRIVATE_KEY",
    "PAYER_PRIVATE_KEY_FILE",
    "payer wallet",
    issues,
  );
  const apiUrl = parseHttpUrl(
    readOptional(env, "API_URL"),
    "API_URL",
    "http://127.0.0.1:4021",
    issues,
  );
  const rpcUrl = parseHttpUrl(readOptional(env, "RPC_URL"), "RPC_URL", DEFAULT_RPC_URL, issues);
  const route = readOptional(env, "DEMO_ROUTE") ?? "/data";
  if (!route.startsWith("/") || route.includes("://") || route.includes(" ")) {
    issues.push("DEMO_ROUTE: must be a path beginning with /");
  }
  const livePaymentApproved = readOptional(env, "LIVE_PAYMENT_APPROVED")?.toUpperCase() === "YES";

  if (issues.length > 0 || privateKey === undefined) {
    throw new ConfigError(issues);
  }

  return { privateKey, apiUrl, route, rpcUrl, livePaymentApproved };
}

/**
 * Two explicit opt-ins are required before the client signs and broadcasts:
 * LIVE_PAYMENT_APPROVED=YES and a configured payer key.
 */
export function assertLivePaymentApproved(config: PayerConfig): void {
  if (!config.livePaymentApproved) {
    throw new ConfigError([
      "live payment not approved: set LIVE_PAYMENT_APPROVED=YES to allow the demo to sign and submit a testnet payment",
      "the demo is intentionally blocked by default; tests and `npm run demo:local` never broadcast",
    ]);
  }
}

/**
 * Print a configuration error without a stack trace. Safe for startup logs.
 */
export function formatStartupError(error: unknown): string {
  if (error instanceof ConfigError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
