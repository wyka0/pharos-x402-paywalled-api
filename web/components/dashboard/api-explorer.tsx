"use client";

import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Code2,
  Copy,
  ExternalLink,
  FileJson,
  Fingerprint,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CopyButton } from "@/components/common/copy-button";
import { JsonView } from "@/components/common/json-view";
import { StatusBadge } from "@/components/common/status-badge";
import { usePaymentDemo } from "@/components/payment/payment-demo-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inspectEndpoint } from "@/lib/client-api";
import { decodePaymentRequiredHeader, truncateHeader } from "@/lib/decode";
import {
  explorerAddressUrl,
  explorerTxUrl,
  formatAtomicUsdc,
  formatDateTime,
  formatDuration,
  formatUsd,
  shortAddress,
  shortHash,
} from "@/lib/format";
import {
  ENDPOINTS,
  ENDPOINT_LIST,
  isPaidEndpoint,
  type EndpointId,
  type InspectResponse,
  type PaymentRequirement,
  type PaymentProof,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export function ApiExplorer({ initialEndpoint }: { initialEndpoint: EndpointId }) {
  const { openDemo, proof } = usePaymentDemo();
  const [selected, setSelected] = useState<EndpointId>(initialEndpoint);
  const [inspection, setInspection] = useState<InspectResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("body");
  const sequence = useRef(0);

  const meta = ENDPOINTS[selected];
  const proofForEndpoint =
    proof && proof.route === meta.path ? proof : null;

  const runInspection = useCallback(async (endpoint: EndpointId) => {
    const id = ++sequence.current;
    setLoading(true);
    setError(null);
    setInspection(null);
    try {
      const response = await inspectEndpoint(endpoint);
      if (id !== sequence.current) return;
      setInspection(response);
      setTab(response.status === 402 ? "requirements" : "body");
    } catch (caught) {
      if (id !== sequence.current) return;
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (id === sequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load is an async external fetch; state updates happen after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runInspection(selected);
  }, [selected, runInspection]);

  const paymentRequired = decodePaymentRequiredHeader(inspection?.headers["payment-required"]);
  const requirement = paymentRequired?.accepts[0] ?? null;
  const status = proofForEndpoint?.responseStatus ?? inspection?.status ?? null;
  const body = proofForEndpoint?.responseBody ?? inspection?.body ?? null;
  const statusLabel =
    status === 200
      ? "200 OK"
      : status === 402
        ? "402 Payment Required"
        : status
          ? `${status} Response`
          : "Pending";
  const tone = status === 200 ? "success" : status === 402 ? "warning" : status ? "danger" : "neutral";

  return (
    <Card id="explorer" className="scroll-mt-5 overflow-hidden p-0">
      <div className="border-b bg-card px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <TerminalSquare className="size-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-foreground">API explorer</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Send real unpaid requests through the server proxy. A 402 is expected for paid
                routes.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void runInspection(selected)}
              disabled={loading}
              className="h-8 bg-transparent text-xs"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Send request
            </Button>
            {isPaidEndpoint(selected) ? (
              <Button
                type="button"
                size="sm"
                onClick={() => openDemo(meta.path as "/data" | "/api/info")}
                className="h-8 text-xs"
              >
                <LockKeyhole className="size-3.5" />
                Run payment demo
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ENDPOINT_LIST.map((endpoint) => {
            const active = endpoint.id === selected;
            return (
              <button
                key={endpoint.id}
                type="button"
                onClick={() => setSelected(endpoint.id)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-all duration-300",
                  active
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "bg-card hover:border-primary/30 hover:bg-secondary/50",
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded px-1 py-0.5 font-mono text-[9px] font-semibold",
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    GET
                  </span>
                  <span className="truncate font-mono text-[11px] font-medium text-foreground">
                    {endpoint.path}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
                  {endpoint.priceUsd ? `$${endpoint.priceUsd}` : "FREE"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : error ? (
          <Alert variant="destructive" className="border-rose-200 bg-rose-50">
            <ShieldAlert className="size-4" />
            <AlertTitle>Could not reach the resource API</AlertTitle>
            <AlertDescription>
              <p className="text-rose-900/80">{error}</p>
              <p className="mt-1 text-[11px] text-rose-800/70">
                Start the API with <code className="font-mono">npm run start:api</code> and try
                again.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void runInspection(selected)}
                className="mt-3 h-8 bg-transparent text-xs"
              >
                <RefreshCw className="size-3.5" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 rounded-xl border bg-secondary/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={statusLabel} tone={tone} pulse={status === 200} />
                {proofForEndpoint ? (
                  <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
                    <CheckCircle2 className="size-3" />
                    Settled response
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    {inspection?.status === 402 ? "Unpaid challenge" : "Live response"}
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {formatDuration(inspection?.elapsedMs)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Fingerprint className="size-3" />
                <span className="font-mono">{meta.path}</span>
                <span className="text-border">·</span>
                <span>{formatDateTime(inspection?.fetchedAt)}</span>
              </div>
            </div>

            {status === 402 && requirement ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-amber-950">
                      Payment required: {formatAtomicUsdc(requirement.amount)} test USDC
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-amber-900/80">
                      The API returned the standard <code className="font-mono">PAYMENT-REQUIRED</code>{" "}
                      header. No protected data is included in a 402 response. Run the gated payment
                      demo to attempt a real testnet settlement.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-amber-300 bg-white/60 font-mono text-[10px] text-amber-900">
                        {requirement.amount} atomic
                      </Badge>
                      <Badge variant="outline" className="border-amber-300 bg-white/60 text-[10px] text-amber-900">
                        {requirement.network}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => openDemo(meta.path as "/data" | "/api/info")}
                        className="h-7 text-[10px]"
                      >
                        <LockKeyhole className="size-3" />
                        Run payment demo
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {proofForEndpoint ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <p className="text-xs font-semibold text-emerald-950">
                      PAYMENT-RESPONSE received from a settled request
                    </p>
                  </div>
                  <Badge variant="outline" className="border-emerald-300 bg-white/60 text-[10px] text-emerald-800">
                    HTTP {proofForEndpoint.responseStatus}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <ProofPill label="success" value={String(proofForEndpoint.settlement.success)} />
                  <ProofPill label="network" value={proofForEndpoint.settlement.network} />
                  <ProofPill
                    label="transaction"
                    value={shortHash(proofForEndpoint.settlement.transaction)}
                    mono
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]">
                  <a
                    href={explorerTxUrl(proofForEndpoint.settlement.transaction)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
                  >
                    PharosScan transaction <ExternalLink className="size-3" />
                  </a>
                  <span className="text-emerald-800/60">
                    Receipt: {proofForEndpoint.receipt.status} · block{" "}
                    {proofForEndpoint.receipt.blockNumber}
                  </span>
                </div>
              </div>
            ) : null}

            <Tabs value={tab} onValueChange={setTab} className="gap-3">
              <TabsList className="h-9 w-full justify-start overflow-x-auto bg-secondary/70 sm:w-fit">
                <TabsTrigger value="body" className="gap-1.5 text-xs">
                  <FileJson className="size-3.5" />
                  Response body
                </TabsTrigger>
                <TabsTrigger value="requirements" className="gap-1.5 text-xs">
                  <ShieldCheck className="size-3.5" />
                  Payment requirements
                </TabsTrigger>
                <TabsTrigger value="headers" className="gap-1.5 text-xs">
                  <Code2 className="size-3.5" />
                  Headers
                </TabsTrigger>
              </TabsList>

              <TabsContent value="body" className="mt-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    {proofForEndpoint
                      ? "Protected response body returned after settlement."
                      : "Real unpaid response body from the resource API."}
                  </p>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {inspection?.bodyType ?? "json"}
                  </Badge>
                </div>
                <JsonView value={body} copyLabel="Response body" />
                {inspection?.status === 402 && !proofForEndpoint ? (
                  <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
                    <ChevronRight className="mt-0.5 size-3 shrink-0" />
                    The 402 body is intentionally empty. The machine-readable requirements are in
                    the PAYMENT-REQUIRED header and the next tab.
                  </p>
                ) : null}
              </TabsContent>

              <TabsContent value="requirements" className="mt-3">
                {requirement ? (
                  <RequirementsPanel requirement={requirement} />
                ) : (
                  <div className="rounded-xl border border-dashed p-5 text-center">
                    <ShieldCheck className="mx-auto size-5 text-emerald-600" />
                    <p className="mt-2 text-xs font-semibold text-foreground">No payment required</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      This endpoint is free and did not send a PAYMENT-REQUIRED header.
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="headers" className="mt-3">
                <HeadersPanel
                  headers={inspection?.headers ?? {}}
                  proof={proofForEndpoint}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </Card>
  );
}

function RequirementsPanel({ requirement }: { requirement: PaymentRequirement }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-secondary/40 px-4 py-2.5">
        <p className="text-xs font-semibold text-foreground">Accepted payment requirements</p>
        <Badge variant="outline" className="border-primary/15 bg-primary/5 font-mono text-[10px] text-primary">
          x402Version 2
        </Badge>
      </div>
      <div className="grid gap-px bg-border sm:grid-cols-2">
        <InfoCell label="Scheme" value={requirement.scheme} />
        <InfoCell label="Network" value={requirement.network} mono />
        <InfoCell label="Amount (atomic)" value={`${requirement.amount} units`} mono />
        <InfoCell
          label="Amount (USDC)"
          value={`${formatAtomicUsdc(requirement.amount)} test USDC`}
        />
        <InfoCell
          label="Asset"
          value={shortAddress(requirement.asset, 8)}
          mono
          link={explorerAddressUrl(requirement.asset)}
          copy={requirement.asset}
        />
        <InfoCell
          label="Recipient"
          value={shortAddress(requirement.payTo, 8)}
          mono
          link={explorerAddressUrl(requirement.payTo)}
          copy={requirement.payTo}
        />
        <InfoCell label="Timeout" value={`${requirement.maxTimeoutSeconds}s`} />
        <InfoCell
          label="EIP-712 domain"
          value={
            requirement.extra?.name && requirement.extra?.version
              ? `${String(requirement.extra.name)} / v${String(requirement.extra.version)}`
              : "not provided"
          }
        />
      </div>
      {requirement.extra && Object.keys(requirement.extra).length > 0 ? (
        <div className="border-t p-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Extra
          </p>
          <JsonView value={requirement.extra} copyLabel="Extra" />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-secondary/20 px-4 py-2.5">
        <p className="text-[10px] text-muted-foreground">
          Header is base64-encoded JSON. Verify the asset and network before paying.
        </p>
        <CopyButton value={JSON.stringify(requirement)} label="Requirements" size="sm" />
      </div>
    </div>
  );
}

function InfoCell({
  label,
  value,
  mono = false,
  link,
  copy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  link?: string;
  copy?: string;
}) {
  return (
    <div className="bg-card p-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-1">
        <p className={cn("min-w-0 truncate text-[11px] font-medium text-foreground", mono && "font-mono")}>
          {value}
        </p>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground transition-colors hover:text-primary"
            aria-label={`Open ${label} on PharosScan`}
          >
            <ExternalLink className="size-3" />
          </a>
        ) : null}
        {copy ? <CopyButton value={copy} label={label} /> : null}
      </div>
    </div>
  );
}

function HeadersPanel({
  headers,
  proof,
}: {
  headers: Record<string, string>;
  proof: PaymentProof | null;
}) {
  const entries = Object.entries(headers);
  return (
    <div className="space-y-3">
      {proof ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
              PAYMENT-RESPONSE (decoded from actual settlement)
            </p>
            <Badge variant="outline" className="border-emerald-300 bg-white/60 text-[9px] text-emerald-800">
              verified
            </Badge>
          </div>
          <div className="mt-2">
            <JsonView value={proof.settlement} copyLabel="PAYMENT-RESPONSE" />
          </div>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border">
        {entries.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">No headers were returned.</p>
        ) : (
          <div className="divide-y">
            {entries.map(([key, value]) => (
              <div key={key} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[180px_1fr] sm:gap-3">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {key}
                </p>
                <div className="flex min-w-0 items-start gap-1">
                  <p className="min-w-0 break-all font-mono text-[10px] leading-relaxed text-foreground">
                    {key === "payment-required" ? truncateHeader(value, 180) : value}
                  </p>
                  <CopyButton value={value} label={key} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {!proof ? (
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          A PAYMENT-RESPONSE header appears only after a successful paid request. Service health
          alone is not settlement.
        </p>
      ) : null}
    </div>
  );
}

function ProofPill({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-white/60 px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.14em] text-emerald-800/70">{label}</p>
      <p className={cn("mt-0.5 truncate text-[11px] font-semibold text-emerald-950", mono && "font-mono")}>
        {value}
      </p>
    </div>
  );
}
