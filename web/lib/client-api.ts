import type {
  EndpointId,
  FacilitatorStatusResponse,
  InspectResponse,
  PaidRoutePath,
  PaymentDemoResult,
} from "./types";

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Expected JSON from ${response.url}, received HTTP ${response.status}`);
  }
}

export async function inspectEndpoint(endpoint: EndpointId): Promise<InspectResponse> {
  const response = await fetch(`/api/x402/${endpoint}`, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  const payload = await readJson<InspectResponse>(response);
  if (typeof payload.status !== "number") {
    throw new Error("The proxy returned an invalid inspection payload");
  }
  return payload;
}

export async function fetchFacilitatorStatus(): Promise<FacilitatorStatusResponse> {
  const response = await fetch("/api/facilitator/status", {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  return await readJson<FacilitatorStatusResponse>(response);
}

export async function runPaymentDemo(
  route: PaidRoutePath,
  approvalToken: string,
): Promise<PaymentDemoResult> {
  const response = await fetch("/api/x402/demo-payment", {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-payment-demo-token": approvalToken,
      accept: "application/json",
    },
    body: JSON.stringify({ route, confirm: true }),
  });
  return await readJson<PaymentDemoResult>(response);
}
