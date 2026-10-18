import { NextResponse } from "next/server";
import { facilitatorOrigin } from "@/lib/server-origin";
import type { FacilitatorHealth, FacilitatorSupported } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

/**
 * Status-only proxy. It reports whether the facilitator answered /health and
 * /supported. It never calls /settle and never implies that a payment settled.
 */
export async function GET(): Promise<NextResponse> {
  const started = Date.now();
  const origin = facilitatorOrigin();
  const signal = AbortSignal.timeout(8_000);

  const [healthResult, supportedResult] = await Promise.allSettled([
    fetch(`${origin}/health`, { cache: "no-store", signal }).then(async (response) => {
      if (!response.ok) throw new Error(`/health returned HTTP ${response.status}`);
      return await readJson<FacilitatorHealth>(response);
    }),
    fetch(`${origin}/supported`, { cache: "no-store", signal }).then(async (response) => {
      if (!response.ok) throw new Error(`/supported returned HTTP ${response.status}`);
      return await readJson<FacilitatorSupported>(response);
    }),
  ]);

  const health = healthResult.status === "fulfilled" ? healthResult.value : null;
  const supported = supportedResult.status === "fulfilled" ? supportedResult.value : null;
  const errors = [healthResult, supportedResult]
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => (result.reason instanceof Error ? result.reason.message : String(result.reason)));

  return NextResponse.json(
    {
      reachable: health !== null || supported !== null,
      health,
      supported,
      checkedAt: new Date().toISOString(),
      elapsedMs: Date.now() - started,
      ...(errors.length > 0 ? { error: errors.join(" | ") } : {}),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
