import type { PaymentRequiredPayload } from "./types";

function normalizeBase64(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  return normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
}

export function decodeBase64Json<T>(value: string): T | null {
  try {
    const decoded = atob(normalizeBase64(value));
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

export function decodePaymentRequiredHeader(value: string | null | undefined): PaymentRequiredPayload | null {
  if (!value) return null;
  const parsed = decodeBase64Json<PaymentRequiredPayload>(value);
  if (!parsed || !Array.isArray(parsed.accepts)) return null;
  return parsed;
}

export function truncateHeader(value: string, max = 96): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}… (${value.length} chars)`;
}
