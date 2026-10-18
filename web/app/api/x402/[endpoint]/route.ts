import { NextResponse } from "next/server";
import { apiOrigin } from "@/lib/server-origin";
import type { EndpointId } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_ENDPOINTS: Record<string, { path: string; id: EndpointId }> = {
  health: { path: "/health", id: "health" },
  data: { path: "/data", id: "data" },
  info: { path: "/api/info", id: "info" },
};

function parseBody(text: string): { body: unknown; bodyType: "json" | "text" } {
  try {
    return { body: JSON.parse(text) as unknown, bodyType: "json" };
  } catch {
    return { body: text, bodyType: "text" };
  }
}

function upstreamHeaders(response: Response): Record<string, string> {
  const names = [
    "content-type",
    "cache-control",
    "payment-required",
    "payment-response",
    "www-authenticate",
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
  ];
  const headers: Record<string, string> = {};
  for (const name of names) {
    const value = response.headers.get(name);
    if (value) headers[name] = value;
  }
  return headers;
}

/**
 * Read-only proxy for the unpaid API explorer. It forwards exactly one of the
 * three allowlisted GET routes and returns the real upstream status (including
 * 402) plus the machine-readable PAYMENT-REQUIRED header.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ endpoint: string }> },
): Promise<NextResponse> {
  const { endpoint: key } = await context.params;
  const target = ALLOWED_ENDPOINTS[key];
  if (!target) {
    return NextResponse.json(
      {
        status: 404,
        ok: false,
        error: `Unknown endpoint "${key}". Allowed: ${Object.keys(ALLOWED_ENDPOINTS).join(", ")}`,
      },
      { status: 404 },
    );
  }

  const started = Date.now();
  try {
    const upstream = await fetch(`${apiOrigin()}${target.path}`, {
      method: "GET",
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    const text = await upstream.text();
    const parsed = parseBody(text);
    const headers = upstreamHeaders(upstream);
    const payload = {
      endpoint: target.id,
      method: "GET",
      path: target.path,
      status: upstream.status,
      ok: upstream.ok,
      headers,
      body: parsed.body,
      bodyType: parsed.bodyType,
      elapsedMs: Date.now() - started,
      fetchedAt: new Date().toISOString(),
    };

    const response = NextResponse.json(payload, { status: upstream.status });
    response.headers.set("cache-control", "no-store");
    if (headers["payment-required"]) {
      response.headers.set("PAYMENT-REQUIRED", headers["payment-required"]);
    }
    if (headers["payment-response"]) {
      response.headers.set("PAYMENT-RESPONSE", headers["payment-response"]);
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        endpoint: target.id,
        method: "GET",
        path: target.path,
        status: 502,
        ok: false,
        headers: {},
        body: null,
        bodyType: "json",
        elapsedMs: Date.now() - started,
        fetchedAt: new Date().toISOString(),
        error: `Could not reach the resource API at ${apiOrigin()}. ${message}`,
      },
      { status: 502 },
    );
  }
}
