import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generatePrivateKey } from "viem/accounts";
import { afterAll, describe, expect, it } from "vitest";
import {
  ConfigError,
  assertLivePaymentApproved,
  assertPaymentDemoReady,
  formatStartupError,
  loadFacilitatorConfig,
  loadPayerConfig,
  loadResourceConfig,
  type Env,
} from "../src/config.js";

const tempDir = mkdtempSync(join(tmpdir(), "pharos-x402-config-"));
const payTo = "0x1111111111111111111111111111111111111111";

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function validResourceEnv(): Env {
  return {
    PAY_TO_ADDRESS: payTo,
    FACILITATOR_URL: "http://127.0.0.1:4022",
  };
}

function issuesOf(fn: () => unknown): string[] {
  try {
    fn();
  } catch (error) {
    if (error instanceof ConfigError) {
      return error.issues;
    }
    throw error;
  }
  throw new Error("Expected ConfigError, but the call succeeded");
}

describe("resource API configuration", () => {
  it("loads a valid local configuration and checksums the address", () => {
    const config = loadResourceConfig(validResourceEnv());
    expect(config.payTo).toBe(payTo);
    expect(config.facilitatorUrl).toBe("http://127.0.0.1:4022");
    expect(config.port).toBe(4021);
    expect(config.trustProxy).toBe(false);
    expect(config.facilitatorTimeoutMs).toBe(30_000);
  });

  it("fails clearly when PAY_TO_ADDRESS is missing", () => {
    const issues = issuesOf(() =>
      loadResourceConfig({ FACILITATOR_URL: "http://127.0.0.1:4022" }),
    );
    expect(issues.join("\n")).toContain("PAY_TO_ADDRESS");
  });

  it("rejects malformed and zero addresses", () => {
    expect(issuesOf(() => loadResourceConfig({ ...validResourceEnv(), PAY_TO_ADDRESS: "0x1234" })).join()).toContain(
      "20-byte",
    );
    expect(
      issuesOf(() =>
        loadResourceConfig({
          ...validResourceEnv(),
          PAY_TO_ADDRESS: "0x0000000000000000000000000000000000000000",
        }),
      ).join(),
    ).toContain("zero address");
  });

  it("fails clearly when FACILITATOR_URL is missing or invalid", () => {
    expect(
      issuesOf(() => loadResourceConfig({ PAY_TO_ADDRESS: payTo })).join(),
    ).toContain("FACILITATOR_URL");
    expect(
      issuesOf(() =>
        loadResourceConfig({ ...validResourceEnv(), FACILITATOR_URL: "ftp://example.com" }),
      ).join(),
    ).toContain("http or https");
  });

  it("rejects a mainnet network identifier", () => {
    const issues = issuesOf(() =>
      loadResourceConfig({ ...validResourceEnv(), NETWORK: "eip155:1672" }),
    );
    expect(issues.join("\n")).toContain("eip155:688689");
  });

  it("rejects a mainnet chain ID", () => {
    const issues = issuesOf(() =>
      loadResourceConfig({ ...validResourceEnv(), CHAIN_ID: "1672" }),
    );
    expect(issues.join("\n")).toContain("688689");
  });

  it("rejects a substituted USDC contract", () => {
    const issues = issuesOf(() =>
      loadResourceConfig({
        ...validResourceEnv(),
        USDC_ADDRESS: "0xE0BE08c77f415F577A1B3A9aD7a1Df1479564ec8",
      }),
    );
    expect(issues.join("\n")).toContain("0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B");
  });

  it("rejects 18 decimals for USDC", () => {
    const issues = issuesOf(() =>
      loadResourceConfig({ ...validResourceEnv(), USDC_DECIMALS: "18" }),
    );
    expect(issues.join("\n")).toContain("USDC_DECIMALS");
  });

  it("validates ports, timeouts, and proxy flags", () => {
    expect(issuesOf(() => loadResourceConfig({ ...validResourceEnv(), PORT: "70000" })).join()).toContain(
      "PORT",
    );
    expect(
      issuesOf(() => loadResourceConfig({ ...validResourceEnv(), FACILITATOR_TIMEOUT_MS: "0" })).join(),
    ).toContain("FACILITATOR_TIMEOUT_MS");
    expect(
      loadResourceConfig({ ...validResourceEnv(), TRUST_PROXY: "true" }).trustProxy,
    ).toBe(true);
    expect(
      issuesOf(() => loadResourceConfig({ ...validResourceEnv(), TRUST_PROXY: "maybe" })).join(),
    ).toContain("TRUST_PROXY");
  });
});

describe("facilitator configuration", () => {
  const key = generatePrivateKey();

  it("loads an inline testnet key and defaults", () => {
    const config = loadFacilitatorConfig({ FACILITATOR_PRIVATE_KEY: key });
    expect(config.privateKey).toBe(key);
    expect(config.port).toBe(4022);
    expect(config.rpcUrl).toBe("https://atlantic.dplabs-internal.com");
    expect(config.confirmationTimeoutMs).toBe(60_000);
  });

  it("loads a key from an ignored file", () => {
    const keyFile = join(tempDir, "facilitator.key");
    writeFileSync(keyFile, `${key}\n`, "utf8");
    const config = loadFacilitatorConfig({ FACILITATOR_PRIVATE_KEY_FILE: keyFile });
    expect(config.privateKey).toBe(key);
  });

  it("fails when neither key source is set", () => {
    expect(issuesOf(() => loadFacilitatorConfig({})).join()).toContain("FACILITATOR_PRIVATE_KEY");
  });

  it("fails when both key sources are set", () => {
    const issues = issuesOf(() =>
      loadFacilitatorConfig({
        FACILITATOR_PRIVATE_KEY: key,
        FACILITATOR_PRIVATE_KEY_FILE: join(tempDir, "facilitator.key"),
      }),
    );
    expect(issues.join()).toContain("only one");
  });

  it("rejects an invalid key without echoing it", () => {
    const secretSentinel = "0xdeadbeefSENTINEL-not-a-private-key";
    const issues = issuesOf(() =>
      loadFacilitatorConfig({ FACILITATOR_PRIVATE_KEY: secretSentinel }),
    );
    expect(issues.join("\n")).toContain("32 bytes");
    expect(issues.join("\n")).not.toContain("SENTINEL");
  });

  it("fails clearly when the key file is missing", () => {
    const issues = issuesOf(() =>
      loadFacilitatorConfig({ FACILITATOR_PRIVATE_KEY_FILE: join(tempDir, "missing.key") }),
    );
    expect(issues.join()).toContain("could not read");
  });
});

describe("payer configuration and live-payment gate", () => {
  const key = generatePrivateKey();

  it("defaults to the local API and refuses live payments", () => {
    const config = loadPayerConfig({ PAYER_PRIVATE_KEY: key });
    expect(config.apiUrl).toBe("http://127.0.0.1:4021");
    expect(config.route).toBe("/data");
    expect(config.livePaymentApproved).toBe(false);
    expect(() => assertLivePaymentApproved(config)).toThrow(/LIVE_PAYMENT_APPROVED=YES/);
  });

  it("accepts explicit approval and a route", () => {
    const config = loadPayerConfig({
      PAYER_PRIVATE_KEY: key,
      LIVE_PAYMENT_APPROVED: "YES",
      DEMO_ROUTE: "/api/info",
    });
    expect(config.livePaymentApproved).toBe(true);
    expect(config.route).toBe("/api/info");
    expect(() => assertLivePaymentApproved(config)).not.toThrow();
  });

  it("rejects a route that is not a path", () => {
    const issues = issuesOf(() =>
      loadPayerConfig({ PAYER_PRIVATE_KEY: key, DEMO_ROUTE: "https://evil.example" }),
    );
    expect(issues.join()).toContain("DEMO_ROUTE");
  });

  it("never includes the key in startup error text", () => {
    const configError = new ConfigError(["payer wallet: invalid"]);
    expect(formatStartupError(configError)).toContain("payer wallet");
    expect(formatStartupError(configError)).not.toContain(key);
  });
});

describe("gated payment demo configuration", () => {
  const demoKey = generatePrivateKey();
  const demoToken = "demo-approval-token-123456";

  it("is disabled by default and does not require a token or payer key", () => {
    const config = loadResourceConfig(validResourceEnv());
    expect(config.paymentDemoEnabled).toBe(false);
    expect(config.paymentDemoApprovalToken).toBeUndefined();
    expect(config.paymentDemoApiUrl).toBe("http://127.0.0.1:4021");
    expect(() => assertPaymentDemoReady(config, validResourceEnv())).not.toThrow();
  });

  it("requires an approval token when enabled", () => {
    const issues = issuesOf(() =>
      loadResourceConfig({
        ...validResourceEnv(),
        PAYMENT_DEMO_ENABLED: "YES",
        LIVE_PAYMENT_APPROVED: "YES",
      }),
    );
    expect(issues.join()).toContain("PAYMENT_DEMO_APPROVAL_TOKEN");
  });

  it("requires a token of at least 16 characters", () => {
    const issues = issuesOf(() =>
      loadResourceConfig({
        ...validResourceEnv(),
        PAYMENT_DEMO_ENABLED: "YES",
        PAYMENT_DEMO_APPROVAL_TOKEN: "short",
        LIVE_PAYMENT_APPROVED: "YES",
      }),
    );
    expect(issues.join()).toContain("at least 16");
  });

  it("requires explicit live approval when enabled", () => {
    const issues = issuesOf(() =>
      loadResourceConfig({
        ...validResourceEnv(),
        PAYMENT_DEMO_ENABLED: "YES",
        PAYMENT_DEMO_APPROVAL_TOKEN: demoToken,
      }),
    );
    expect(issues.join()).toContain("LIVE_PAYMENT_APPROVED");
  });

  it("loads when both opt-ins and the token are present", () => {
    const config = loadResourceConfig({
      ...validResourceEnv(),
      PAYMENT_DEMO_ENABLED: "YES",
      PAYMENT_DEMO_APPROVAL_TOKEN: demoToken,
      LIVE_PAYMENT_APPROVED: "YES",
    });
    expect(config.paymentDemoEnabled).toBe(true);
    expect(config.paymentDemoApprovalToken).toBe(demoToken);
  });

  it("does not echo the approval token in errors", () => {
    const issues = issuesOf(() =>
      loadResourceConfig({
        ...validResourceEnv(),
        PAYMENT_DEMO_ENABLED: "YES",
        PAYMENT_DEMO_APPROVAL_TOKEN: "short",
        LIVE_PAYMENT_APPROVED: "NO",
      }),
    );
    expect(issues.join()).not.toContain("short");
  });

  it("requires a server-side payer key in the startup readiness check", () => {
    const config = loadResourceConfig({
      ...validResourceEnv(),
      PAYMENT_DEMO_ENABLED: "YES",
      PAYMENT_DEMO_APPROVAL_TOKEN: demoToken,
      LIVE_PAYMENT_APPROVED: "YES",
    });
    const issues = issuesOf(() => assertPaymentDemoReady(config, {}));
    expect(issues.join()).toContain("PAYER_PRIVATE_KEY");
  });

  it("passes the readiness check with approval and a payer key", () => {
    const env: Env = {
      ...validResourceEnv(),
      PAYMENT_DEMO_ENABLED: "YES",
      PAYMENT_DEMO_APPROVAL_TOKEN: demoToken,
      LIVE_PAYMENT_APPROVED: "YES",
      PAYER_PRIVATE_KEY: demoKey,
    };
    const config = loadResourceConfig(env);
    expect(() => assertPaymentDemoReady(config, env)).not.toThrow();
  });
});
