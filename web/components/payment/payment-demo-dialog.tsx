"use client";

import {
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  Info,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { JsonView } from "@/components/common/json-view";
import { CopyButton } from "@/components/common/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { runPaymentDemo } from "@/lib/client-api";
import {
  explorerTxUrl,
  formatAtomicUsdc,
  formatDateTime,
  shortHash,
} from "@/lib/format";
import { ENDPOINTS, type PaidRoutePath, type PaymentDemoResult, type PaymentProof } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAID_ROUTES: PaidRoutePath[] = ["/data", "/api/info"];

export function PaymentDemoDialog({
  open,
  onOpenChange,
  route,
  onRouteChange,
  onSettled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: PaidRoutePath;
  onRouteChange: (route: PaidRoutePath) => void;
  onSettled: (proof: PaymentProof) => void;
}) {
  const [approvalToken, setApprovalToken] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PaymentDemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const settled = result?.status === "settled" ? result : null;

  const reset = () => {
    setApprovalToken("");
    setConfirmed(false);
    setRunning(false);
    setResult(null);
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const chooseRoute = (nextRoute: PaidRoutePath) => {
    if (running) return;
    onRouteChange(nextRoute);
    setResult(null);
    setError(null);
    setConfirmed(false);
  };

  const run = async () => {
    if (running || !confirmed || approvalToken.trim().length === 0) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const response = await runPaymentDemo(route, approvalToken.trim());
      setResult(response);
      if (response.status === "settled") {
        onSettled(response);
        toast.success("Settlement confirmed", {
          description: `HTTP 200 received. Transaction ${shortHash(response.settlement.transaction)}`,
        });
      } else if (response.status === "not_configured") {
        toast.info("Live demo is disabled on this server");
      } else {
        toast.error(response.message);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      toast.error("Payment demo could not run");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 py-4 pr-12 sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <LockKeyhole className="size-5 text-primary" />
            Run an approved payment demo
          </DialogTitle>
          <DialogDescription>
            The browser never holds a payer key. This asks the Express API to run the existing
            x402 client on the server, only after an explicit approval token and confirmation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-amber-950">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-1 text-xs leading-relaxed">
              <p className="font-semibold">This can broadcast a real Atlantic Testnet transaction.</p>
              <p className="text-amber-900/80">
                It spends test USDC from the server-side payer and PHRS from the facilitator. It is
                disabled by default. A local stub or mock hash can never appear here as proof.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Paid endpoint
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {PAID_ROUTES.map((candidate) => {
                const meta = candidate === "/data" ? ENDPOINTS.data : ENDPOINTS.info;
                const selected = candidate === route;
                return (
                  <button
                    key={candidate}
                    type="button"
                    onClick={() => chooseRoute(candidate)}
                    disabled={running}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-all duration-300",
                      selected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "bg-card hover:border-primary/40 hover:bg-secondary/60",
                      running && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <span>
                      <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground">
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                          GET
                        </span>
                        {candidate}
                      </span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {meta.description}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-bold text-foreground">${meta.priceUsd}</span>
                      <span className="block text-[10px] text-muted-foreground">test USDC</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="payment-demo-token"
              className="flex items-center gap-1.5 text-sm font-medium text-foreground"
            >
              <KeyRound className="size-4 text-primary" />
              Server approval token
            </label>
            <Input
              id="payment-demo-token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={approvalToken}
              onChange={(event) => setApprovalToken(event.target.value)}
              placeholder="Paste PAYMENT_DEMO_APPROVAL_TOKEN from the server"
              disabled={running || settled !== null}
              className="h-10 font-mono text-xs"
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              This is not a private key. The API compares it server-side before it will run the
              payment client.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-secondary/40 p-3.5">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(value) => setConfirmed(value === true)}
              disabled={running || settled !== null}
              className="mt-0.5"
            />
            <span className="text-xs leading-relaxed text-muted-foreground">
              I understand this is a real testnet transaction and that a successful result will show
              an actual transaction hash and PharosScan link.
            </span>
          </label>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900">
              <p className="font-semibold">Request failed</p>
              <p className="mt-1 break-words text-rose-800">{error}</p>
              <p className="mt-1 text-rose-700/80">
                No settlement is claimed. Check the API and facilitator logs.
              </p>
            </div>
          ) : null}

          {result?.status === "not_configured" ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Live demo is disabled on this server</p>
                  <p className="mt-1 text-xs leading-relaxed text-sky-900/80">
                    No transaction was requested and the proof section remains empty. Enable it with
                    all of the following:
                  </p>
                </div>
              </div>
              <ul className="mt-3 grid gap-1.5 text-[11px]">
                {(result.required ?? []).map((item) => (
                  <li key={item} className="flex items-center gap-2 font-mono">
                    <span className="size-1.5 rounded-full bg-sky-500" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-sky-900/70">
                The payer key stays server-side. The facilitator also needs PHRS for gas.
              </p>
            </div>
          ) : null}

          {result && result.status !== "settled" && result.status !== "not_configured" ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-950">
              <p className="text-sm font-semibold">
                {result.status === "approval_required"
                  ? "Approval token rejected"
                  : result.status === "busy"
                    ? "A payment demo is already running"
                    : result.status === "confirmation_required"
                      ? "Confirmation required"
                      : "Payment demo did not settle"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-rose-900/80">{result.message}</p>
              <p className="mt-2 text-[11px] text-rose-800/70">
                No transaction hash is displayed because no verified settlement was returned.
              </p>
            </div>
          ) : null}

          {settled ? <SettledPanel result={settled} /> : null}
        </div>

        <DialogFooter className="sticky bottom-0 border-t bg-card/95 px-5 py-4 backdrop-blur sm:px-6">
          {settled ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  handleOpenChange(false);
                  router.push("/proof");
                }}
              >
                View transaction proof
                <ArrowUpRight className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={running}>
                Cancel
              </Button>
              <Button
                onClick={run}
                disabled={
                  running ||
                  !confirmed ||
                  approvalToken.trim().length === 0 ||
                  result?.status === "not_configured"
                }
              >
                {running ? (
                  <>
                    <Spinner />
                    Running server-side payment
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4" />
                    Run payment demo
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettledPanel({ result }: { result: Extract<PaymentDemoResult, { status: "settled" }> }) {
  const link = result.settlement.transaction
    ? explorerTxUrl(result.settlement.transaction)
    : null;

  return (
    <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-950">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold">Settlement confirmed</p>
            <p className="mt-0.5 text-xs text-emerald-900/80">
              The paid request returned HTTP 200 after the facilitator verified and settled it.
            </p>
          </div>
        </div>
        <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800" variant="outline">
          on-chain
        </Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-card p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Transaction
          </p>
          <div className="mt-1 flex items-center gap-1">
            <code className="min-w-0 break-all font-mono text-[11px] text-foreground">
              {result.settlement.transaction}
            </code>
            <CopyButton value={result.settlement.transaction} label="Transaction hash" />
          </div>
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline"
            >
              View on PharosScan <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-emerald-200 bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Paid</p>
            <p className="mt-1 text-sm font-bold text-foreground">
              {formatAtomicUsdc(result.amountAtomic)} USDC
            </p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Block</p>
            <p className="mt-1 text-sm font-bold text-foreground">{result.receipt.blockNumber}</p>
          </div>
        </div>
      </div>

      <Separator className="bg-emerald-200" />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-card p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            PAYMENT-RESPONSE (decoded)
          </p>
          <dl className="mt-2 space-y-1.5 text-[11px]">
            <Row label="success" value={String(result.settlement.success)} />
            <Row label="network" value={result.settlement.network} />
            <Row label="payer" value={shortHash(result.settlement.payer ?? result.payer)} mono />
            <Row label="settled" value={formatDateTime(result.settledAt)} />
          </dl>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-card p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Receipt
          </p>
          <dl className="mt-2 space-y-1.5 text-[11px]">
            <Row label="status" value={result.receipt.status} />
            <Row label="token" value={shortHash(result.receipt.to)} mono />
            <Row label="gas used" value={result.receipt.gasUsed} />
            <Row label="transfer" value={`${formatAtomicUsdc(result.receipt.transfer.value)} USDC`} />
          </dl>
        </div>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Protected response
          <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-[9px] text-emerald-800">
            HTTP {result.responseStatus}
          </Badge>
        </p>
        <JsonView value={result.responseBody} copyLabel="Response body" />
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("max-w-[65%] break-all text-right text-foreground", mono && "font-mono")}>
        {value}
      </dd>
    </div>
  );
}
