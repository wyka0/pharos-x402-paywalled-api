export type EndpointId = "health" | "data" | "info";
export type PaidEndpointId = Exclude<EndpointId, "health">;
export type PaidRoutePath = "/data" | "/api/info";

export interface EndpointMeta {
  id: EndpointId;
  method: "GET";
  path: string;
  label: string;
  priceUsd: string | null;
  priceAtomic: string | null;
  description: string;
  paid: boolean;
  accent: "primary" | "emerald" | "neutral";
}

export const ENDPOINTS: Record<EndpointId, EndpointMeta> = {
  health: {
    id: "health",
    method: "GET",
    path: "/health",
    label: "Health",
    priceUsd: null,
    priceAtomic: null,
    description: "Liveness and network metadata. No payment required.",
    paid: false,
    accent: "emerald",
  },
  data: {
    id: "data",
    method: "GET",
    path: "/data",
    label: "Premium data",
    priceUsd: "0.01",
    priceAtomic: "10000",
    description: "Premium sample dataset. 10,000 atomic test USDC per call.",
    paid: true,
    accent: "primary",
  },
  info: {
    id: "info",
    method: "GET",
    path: "/api/info",
    label: "API info",
    priceUsd: "0.005",
    priceAtomic: "5000",
    description: "API metadata and endpoint catalog. 5,000 atomic test USDC per call.",
    paid: true,
    accent: "neutral",
  },
};

export const ENDPOINT_LIST: EndpointMeta[] = [
  ENDPOINTS.health,
  ENDPOINTS.data,
  ENDPOINTS.info,
];

export function isPaidEndpoint(id: EndpointId): id is PaidEndpointId {
  return id === "data" || id === "info";
}

export function endpointById(id: string): EndpointMeta | undefined {
  return ENDPOINT_LIST.find((endpoint) => endpoint.id === id);
}

export function endpointByPath(path: string): EndpointMeta | undefined {
  return ENDPOINT_LIST.find((endpoint) => endpoint.path === path);
}

export function paidRouteForEndpoint(id: PaidEndpointId): PaidRoutePath {
  return id === "data" ? "/data" : "/api/info";
}

export interface InspectResponse {
  endpoint: EndpointId | string;
  method: string;
  path: string;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: unknown;
  bodyType: "json" | "text";
  elapsedMs: number;
  fetchedAt: string;
  error?: string;
}

export interface PaymentRequirement {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

export interface PaymentRequiredPayload {
  x402Version: number;
  error?: string;
  resource?: {
    url?: string;
    description?: string;
    mimeType?: string;
  };
  accepts: PaymentRequirement[];
}

export interface SettlementResult {
  success: boolean;
  transaction: string;
  network: string;
  payer?: string;
  amount?: string;
  errorReason?: string;
  errorMessage?: string;
}

export interface ReceiptSummary {
  status: string;
  blockNumber: string;
  transactionHash: string;
  broadcaster: string;
  to: string;
  gasUsed: string;
  transfer: {
    from: string;
    to: string;
    value: string;
  };
}

export interface PaymentDemoSettled {
  status: "settled";
  route: PaidRoutePath;
  network: string;
  payer: string;
  amountAtomic: string;
  responseStatus: number;
  responseBody: unknown;
  settlement: SettlementResult;
  receipt: ReceiptSummary;
  explorerUrl: string;
  settledAt: string;
}

export interface PaymentDemoBlocked {
  status: "not_configured" | "approval_required" | "confirmation_required" | "busy" | "failed";
  message: string;
  required?: string[];
}

export type PaymentDemoResult = PaymentDemoSettled | PaymentDemoBlocked;

export interface PaymentProof extends PaymentDemoSettled {}

export interface FacilitatorHealth {
  status?: string;
  service?: string;
  network?: string;
  networkName?: string;
  chainId?: number;
  scheme?: string;
  asset?: string;
  assetDecimals?: number;
  signers?: string[];
  cachedSettlements?: number;
  timestamp?: string;
}

export interface SupportedKind {
  x402Version: number;
  scheme: string;
  network: string;
  extra?: Record<string, unknown>;
}

export interface FacilitatorSupported {
  kinds: SupportedKind[];
  extensions: string[];
  signers: Record<string, string[]>;
}

export interface FacilitatorStatusResponse {
  reachable: boolean;
  health: FacilitatorHealth | null;
  supported: FacilitatorSupported | null;
  checkedAt: string;
  elapsedMs: number;
  error?: string;
}
