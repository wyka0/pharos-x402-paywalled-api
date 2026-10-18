/**
 * Server-only origin resolution for the Next route handlers.
 *
 * These variables intentionally do not use the NEXT_PUBLIC_ prefix: the browser
 * never needs the internal Express or facilitator URLs, and no signing material
 * is ever exposed to client JavaScript.
 */
export function resolveServerOrigin(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
    if (url.username || url.password) return fallback;
    return value.replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

export function apiOrigin(): string {
  return resolveServerOrigin(process.env.API_ORIGIN, "http://127.0.0.1:4021");
}

export function facilitatorOrigin(): string {
  return resolveServerOrigin(process.env.FACILITATOR_ORIGIN, "http://127.0.0.1:4022");
}
