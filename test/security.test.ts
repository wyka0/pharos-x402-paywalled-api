import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.isFile() && entry.name.endsWith(".ts") ? [full] : [];
  });
}

describe("secret hygiene", () => {
  it("contains no hardcoded private keys or PEM key blocks in src/", () => {
    const files = sourceFiles(join(process.cwd(), "src"));
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content).not.toMatch(
        /(?:PRIVATE_KEY|MNEMONIC|SECRET)\s*[:=]\s*["'`]?0x[0-9a-fA-F]{64}/,
      );
      expect(content).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----/);
    }
  });

  it("ignores environment files, local key files, and secret directories", () => {
    const gitignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    for (const pattern of [".env", ".secrets/", ".private_key", "*.key"]) {
      expect(gitignore).toContain(pattern);
    }
    expect(gitignore).toContain("!.env.example");
  });

  it("ships only placeholders in .env.example", () => {
    const example = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    expect(example).toContain("PAY_TO_ADDRESS=");
    expect(example).toContain("FACILITATOR_PRIVATE_KEY=");
    expect(example).toContain("PAYER_PRIVATE_KEY=");
    expect(example).not.toMatch(/0x[0-9a-fA-F]{64}/);
  });

  it("keeps the live-payment approval gate in the client", () => {
    const demo = readFileSync(join(process.cwd(), "src/client/demo.ts"), "utf8");
    expect(demo).toContain("assertLivePaymentApproved");
    expect(demo).toContain("Nothing was signed. Nothing was broadcast.");
  });
});
