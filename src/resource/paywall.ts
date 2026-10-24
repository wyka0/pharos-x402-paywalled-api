import type { PaywallProvider } from "@x402/core/server";
import { formatAtomic } from "../amounts.js";
import { EXPLORER_BASE_URL, NETWORK_NAME, USDC_ADDRESS, USDC_DECIMALS } from "../network.js";

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

/**
 * Escape a value for safe interpolation into the paywall HTML. Values come from
 * our own configuration and the challenge object, but the resource URL echoes
 * the request target, so every interpolated value is escaped defensively.
 */
function escapeHtml(value: string): string {
  // Entity names are assembled from concatenated pieces so this file contains
  // no bare HTML entity literals that could be silently decoded.
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&" + "amp;";
    if (char === "<") return "&" + "lt;";
    if (char === ">") return "&" + "gt;";
    if (char === '"') return "&" + "quot;";
    return "&" + "#39;";
  });
}

function addressLink(label: string, value: string): string {
  if (!ADDRESS_PATTERN.test(value)) {
    return escapeHtml(value || "—");
  }
  return (
    `<a href="${escapeHtml(`${EXPLORER_BASE_URL}/address/${value}`)}" ` +
    `target="_blank" rel="noreferrer">${escapeHtml(value)}</a> ` +
    `<span class="muted">(${escapeHtml(label)})</span>`
  );
}

function row(label: string, value: string): string {
  return (
    `<tr><th scope="row">${escapeHtml(label)}</th>` +
    `<td>${value}</td></tr>`
  );
}

/**
 * Project-specific browser paywall.
 *
 * The SDK's fallback page tells developers to install @x402/paywall. This
 * provider replaces it with a self-contained page that decodes and displays the
 * actual challenge (scheme, network, asset, amount, recipient, timeout) and
 * explains the programmatic payment flow. It has no scripts, no external
 * assets, and never renders wallet UIs or signs anything: the browser only
 * ever receives the same machine-readable PAYMENT-REQUIRED header a JSON
 * client would receive.
 */
export function createProjectPaywall(): PaywallProvider {
  return {
    generateHtml(paymentRequired): string {
      const accepts = Array.isArray(paymentRequired.accepts)
        ? (paymentRequired.accepts as unknown as Array<Record<string, unknown>>)
        : [];
      const first = accepts[0] ?? {};

      const rawAmount = typeof first["amount"] === "string" ? first["amount"] : "";
      const amountAtomic = /^\d+$/.test(rawAmount) ? rawAmount : "";
      const amountHuman =
        amountAtomic !== "" ? formatAtomic(amountAtomic, USDC_DECIMALS) : "";
      const asset = typeof first["asset"] === "string" ? first["asset"] : "";
      const payTo = typeof first["payTo"] === "string" ? first["payTo"] : "";
      const network = typeof first["network"] === "string" ? first["network"] : "";
      const scheme = typeof first["scheme"] === "string" ? first["scheme"] : "";
      const maxTimeoutSeconds =
        typeof first["maxTimeoutSeconds"] === "number" ? String(first["maxTimeoutSeconds"]) : "";

      const resource = paymentRequired.resource;
      const resourceUrl =
        typeof resource?.url === "string" ? resource.url : "";
      const description =
        typeof resource?.description === "string" ? resource.description : "";

      const amountCell =
        amountAtomic !== ""
          ? `${escapeHtml(amountAtomic)} atomic` +
            (amountHuman !== "" ? ` <span class="muted">(${escapeHtml(amountHuman)} test USDC)</span>` : "")
          : "—";

      return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>402 Payment Required — Pharos x402 Paywalled API</title>
    <style>
      body { margin: 0; padding: 40px 16px; background: #f8fafc; color: #0f172a;
             font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
      main { max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0;
             border-radius: 12px; padding: 28px; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      p { font-size: 13px; line-height: 1.6; margin: 8px 0; }
      .badge { display: inline-block; font-size: 11px; font-weight: 600; color: #92400e;
               background: #fef3c7; border: 1px solid #fcd34d; border-radius: 999px;
               padding: 2px 10px; margin-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
      th, td { text-align: left; padding: 8px 10px; border-top: 1px solid #e2e8f0;
               vertical-align: top; word-break: break-all; }
      th { width: 140px; color: #475569; font-weight: 600; }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
             background: #f1f5f9; padding: 1px 5px; border-radius: 4px; }
      a { color: #1d4ed8; }
      .muted { color: #64748b; font-size: 12px; }
      .note { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;
              padding: 12px 14px; font-size: 12.5px; }
    </style>
  </head>
  <body>
    <main>
      <span class="badge">HTTP 402 — Payment Required</span>
      <h1>This resource requires an x402 payment</h1>
      <p>${escapeHtml(description || "A paid endpoint of the Pharos x402 Paywalled API.")}</p>
      <table>
        ${row("Resource", resourceUrl !== "" ? `<code>${escapeHtml(resourceUrl)}</code>` : "—")}
        ${row("Scheme", escapeHtml(scheme || "—"))}
        ${row("Network", `${escapeHtml(network || "—")} <span class="muted">(${escapeHtml(NETWORK_NAME)})</span>`)}
        ${row("Asset", addressLink("test USDC", asset || USDC_ADDRESS))}
        ${row("Amount", amountCell)}
        ${row("Recipient", addressLink("payTo", payTo))}
        ${row("Max timeout", maxTimeoutSeconds !== "" ? `${escapeHtml(maxTimeoutSeconds)} seconds` : "—")}
        ${row("x402 version", escapeHtml(String(paymentRequired.x402Version ?? "—")))}
      </table>
      <div class="note">
        <p style="margin:0 0 6px;"><strong>Programmatic clients:</strong> read the
        <code>PAYMENT-REQUIRED</code> response header (base64-encoded JSON with the
        requirements above), sign an EIP-3009 authorization with the <code>exact</code>
        scheme, and retry the request with a <code>PAYMENT-SIGNATURE</code> header. The
        facilitator verifies and settles the payment on-chain before the protected
        response is returned.</p>
        <p style="margin:0;"><strong>Browsers:</strong> this page is the human-readable
        fallback for the same 402 challenge. No wallet connection or signing happens
        here. Settlements are visible on PharosScan after a real paid request.</p>
      </div>
      <p class="muted" style="margin-top:14px;">Pharos Atlantic Testnet — test USDC has no
      real value. The same challenge is always available in the
      <code>PAYMENT-REQUIRED</code> header of this response.</p>
    </main>
  </body>
</html>`;
    },
  };
}
