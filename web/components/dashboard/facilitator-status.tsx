"use client";

import {
  Activity,
  CircleSlash,
  ExternalLink,
  Info,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { StatusBadge, StatusDot } from "@/components/common/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchFacilitatorStatus } from "@/lib/client-api";
import {
  explorerAddressUrl,
  formatDateTime,
  formatDuration,
  shortAddress,
} from "@/lib/format";
import type { FacilitatorStatusResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const capabilities = [
  {
    method: "GET",
    path: "/supported",
    label: "Capability discovery",
    detail: "Advertises the exact scheme, network, and facilitator signer.",
  },
  {
    method: "POST",
    path: "/verify",
    label: "Authorization verification",
    detail: "Checks signature, recipient, amount, expiry, and nonce. Never settles.",
  },
  {
    method: "POST",
    path: "/settle",
    label: "On-chain settlement",
    detail: "Broadcasts transferWithAuthorization and waits for a receipt.",
  },
];

export function FacilitatorStatus({ className }: { className?: string }) {
  const [status, setStatus] = useState<FacilitatorStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchFacilitatorStatus();
      if (!mounted.current) return;
      setStatus(response);
    } catch (caught) {
      if (!mounted.current) return;
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    // Initial load is an async external fetch; state updates happen after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => {
      mounted.current = false;
      window.clearInterval(interval);
    };
  }, [load]);

  const online = status?.reachable === true && status.health?.status === "ok";
  const kind = status?.supported?.kinds?.[0] ?? null;
  const signer =
    status?.health?.signers?.[0] ??
    status?.supported?.signers?.["eip155:*"]?.[0] ??
    null;

  return (
    <Card className={cn("overflow-hidden p-0", className)}>
      <div className="flex flex-col gap-3 border-b bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ServerCog className="size-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Self-hosted facilitator
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The resource API delegates verification and settlement to this service.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && !status ? (
            <Skeleton className="h-6 w-24 rounded-full" />
          ) : (
            <StatusBadge
              label={online ? "Facilitator online" : "Unreachable"}
              tone={online ? "success" : "danger"}
              pulse={online}
            />
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="h-8 bg-transparent text-xs"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {loading && !status ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : error ? (
          <Alert variant="destructive" className="border-rose-200 bg-rose-50">
            <CircleSlash className="size-4" />
            <AlertTitle>Facilitator status unavailable</AlertTitle>
            <AlertDescription>
              <p className="text-rose-900/80">{error}</p>
              <p className="mt-1 text-[11px] text-rose-800/70">
                Start it with <code className="font-mono">npm run start:facilitator</code>, then
                refresh.
              </p>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              <Fact
                icon={<Activity className="size-3.5" />}
                label="Scheme"
                value={kind?.scheme ?? status?.health?.scheme ?? "—"}
              />
              <Fact
                icon={<ShieldCheck className="size-3.5" />}
                label="Network"
                value={kind?.network ?? status?.health?.network ?? "—"}
                mono
              />
              <Fact
                icon={<Wallet className="size-3.5" />}
                label="Signer"
                value={signer ? shortAddress(signer, 5) : "—"}
                mono
                link={signer ? explorerAddressUrl(signer) : undefined}
              />
            </div>

            <div className="overflow-hidden rounded-xl border">
              <div className="flex items-center justify-between gap-2 border-b bg-secondary/40 px-4 py-2.5">
                <p className="text-xs font-semibold text-foreground">Facilitator endpoints</p>
                <Badge variant="outline" className="text-[9px] text-muted-foreground">
                  capability status
                </Badge>
              </div>
              <div className="divide-y">
                {capabilities.map((capability) => {
                  const isSettle = capability.path === "/settle";
                  return (
                    <div
                      key={capability.path}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "px-1.5 py-0 font-mono text-[9px]",
                              capability.method === "POST"
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : "border-primary/15 bg-primary/5 text-primary",
                            )}
                          >
                            {capability.method}
                          </Badge>
                          <code className="font-mono text-[11px] font-semibold text-foreground">
                            {capability.path}
                          </code>
                          <span className="text-[11px] text-muted-foreground">· {capability.label}</span>
                        </div>
                        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                          {capability.detail}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {isSettle ? (
                          <Badge
                            variant="outline"
                            className="border-amber-200 bg-amber-50 text-[9px] font-medium text-amber-800"
                          >
                            <Info className="size-2.5" />
                            capability only
                          </Badge>
                        ) : (
                          <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                            <StatusDot tone={online ? "success" : "neutral"} />
                            {online ? "available" : "unknown"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50/70 p-3.5">
              <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />
              <div className="text-[11px] leading-relaxed text-sky-950">
                <p className="font-semibold">Service health is not settlement.</p>
                <p className="mt-0.5 text-sky-900/80">
                  An online facilitator only means the HTTP service and signer metadata responded.
                  A successful settlement is shown exclusively in Transaction proof, after a real
                  paid request returns a confirmed receipt.
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span>
                Checked {formatDateTime(status?.checkedAt)} · {formatDuration(status?.elapsedMs)}
              </span>
              {status?.health?.cachedSettlements !== undefined ? (
                <span className="font-mono">
                  cached settlements: {status.health.cachedSettlements}
                </span>
              ) : null}
              <a
                href="https://docs.pharos.xyz/developer-guide/x402/x402-atlantic-testnet"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                Pharos x402 guide <ExternalLink className="size-2.5" />
              </a>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function Fact({
  icon,
  label,
  value,
  mono = false,
  link,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  link?: string;
}) {
  return (
    <div className="rounded-xl border bg-secondary/30 p-3">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </p>
      <div className="mt-1 flex items-center gap-1">
        <p className={cn("truncate text-xs font-semibold text-foreground", mono && "font-mono")}>
          {value}
        </p>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-primary"
            aria-label={`Open ${label} on PharosScan`}
          >
            <ExternalLink className="size-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
