import { NextResponse } from "next/server";
import { apiOrigin } from "@/lib/server-origin";
import type { PaymentDemoResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * The upstream Express API performs a real testnet settlement (facilitator
 * verification, on-chain broadcast, receipt confirmation) before answering.
 * This route bounds that wait with the 120s AbortSignal below, so the function
 * must be allowed to outlive it slightly in order to return its own JSON error
 * instead of being killed by the platform. Vercel Hobby and Pro allow up to
 * 300s (Fluid Compute); no plan limit is exceeded.
 */
export const maxDuration = 130;

interface DemoBody {
  route?: string;
  confirm?: boolean;
}

/**
 * Server-side proxy for the explicitly gated payment demo. The browser supplies
 * a manually entered approval token, not a private key. The Express API validates
 * the token, the confirm flag, and its own environment before running the real
 * x402 client. No signing happens in the browser.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: DemoBody;
  try {
    body = (await request.json()) as DemoBody;
  } catch {
    return NextResponse.json(
      { status: "failed", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (body.route !== "/data" && body.route !== "/api/info") {
    return NextResponse.json(
      { status: "failed", message: "route must be /data or /api/info" },
      { status: 400 },
    );
  }
  if (body.confirm !== true) {
    return NextResponse.json(
      { status: "confirmation_required", message: "Explicit confirmation is required." },
      { status: 400 },
    );
  }

  const approvalToken = request.headers.get("x-payment-demo-token");
  if (!approvalToken) {
    return NextResponse.json(
      {
        status: "approval_required",
        message: "Enter the server's payment-demo approval token to continue.",
      },
      { status: 403 },
    );
  }

  try {
    const upstream = await fetch(`${apiOrigin()}/demo/payment`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-payment-demo-token": approvalToken,
        accept: "application/json",
      },
      body: JSON.stringify({ route: body.route, confirm: true }),
      signal: AbortSignal.timeout(120_000),
    });
    const text = await upstream.text();
    let payload: PaymentDemoResult;
    try {
      payload = JSON.parse(text) as PaymentDemoResult;
    } catch {
      payload = {
        status: "failed",
        message: `The resource API returned a non-JSON response (HTTP ${upstream.status}).`,
      };
    }
    return NextResponse.json(payload, {
      status: upstream.status,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        status: "failed",
        message: `Could not reach the resource API at ${apiOrigin()}. ${message}`,
      },
      { status: 502 },
    );
  }
}
