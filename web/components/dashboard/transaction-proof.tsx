"use client";

import {
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  FileCheck2,
  ReceiptText,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/common/copy-button";
import { JsonView } from "@/components/common/json-view";
import { StatusBadge } from "@/components/common/status-badge";
import { usePaymentDemo } from "@/components/payment/payment-demo-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  explorerAddressUrl,
  explorerTxUrl,
  formatAtomicUsdc,
  formatDateTime,
  isTxHash,
  shortHash,
} from "@/lib/format";

export function TransactionProof() {
  const { proof, clearProof, openDemo } = usePaymentDemo();

  return (
    <Card id="proof" className="scroll-mt-5 overflow-hidden p-0">
      <div className="flex flex-col gap-3 border-b bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ReceiptText className="size-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Transaction proof
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The only place where a settled payment is shown as on-chain evidence.
            </p>
          </div>
        </div>
        {proof ? (
          <div className="flex items-center gap-2">
            <StatusBadge label="Settled on-chain" tone="success" pulse />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearProof}
              className="h-8 text-[10px] text-muted-foreground"
            >
              <Trash2 className="size-3" />
              Clear session view
            </Button>
          </div>
        ) : (
          <StatusBadge label="No live transaction yet" tone="neutral" />
        )}
      </div>

      {proof ? (
        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-emerald-950">
                    Receipt verified for {formatAtomicUsdc(proof.amountAtomic)} test USDC
                  </p>
                  <p className="mt-0.5 text-[11px] text-emerald-900/80">
                    {formatDateTime(proof.settledAt)} · {proof.network} · block{" "}
                    {proof.receipt.blockNumber}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="border-emerald-300 bg-white/70 text-[10px] text-emerald-800">
                receipt {proof.receipt.status}
              </Badge>
            </div>
          </div>

          <div className="grid gap-2 lg:grid-cols-[1.4fr_0.6fr]">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Transaction hash
              </p>
              <div className="mt-2 flex items-start gap-1.5">
                <code className="min-w-0 break-all font-mono text-[11px] leading-relaxed text-foreground">
                  {proof.settlement.transaction}
                </code>
                <CopyButton value={proof.settlement.transaction} label="Transaction hash" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {isTxHash(proof.settlement.transaction) ? (
                  <Button asChild size="sm" className="h-8 text-xs">
                    <a
                      href={explorerTxUrl(proof.settlement.transaction)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open PharosScan
                      <ArrowUpRight className="size-3.5" />
                    </a>
                  </Button>
                ) : null}
                <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                  {proof.route}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ProofFact label="Paid" value={`${formatAtomicUsdc(proof.amountAtomic)} USDC`} icon={<CircleDollarSign className="size-3.5" />} />
              <ProofFact label="Block" value={proof.receipt.blockNumber} icon={<FileCheck2 className="size-3.5" />} />
              <ProofFact label="Gas used" value={proof.receipt.gasUsed} icon={<ShieldCheck className="size-3.5" />} />
              <ProofFact label="HTTP" value={String(proof.responseStatus)} icon={<CheckCircle2 className="size-3.5" />} />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Detail
              label="Payer"
              value={shortHash(proof.payer)}
              mono
              link={explorerAddressUrl(proof.payer)}
            />
            <Detail
              label="Broadcaster"
              value={shortHash(proof.receipt.broadcaster)}
              mono
              link={explorerAddressUrl(proof.receipt.broadcaster)}
            />
            <Detail
              label="USDC token"
              value={shortHash(proof.receipt.to)}
              mono
              link={explorerAddressUrl(proof.receipt.to)}
            />
          </div>

          <div className="rounded-xl border bg-secondary/20 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Verified Transfer log
            </p>
            <p className="mt-1 break-all font-mono text-[11px] text-foreground">
              {proof.receipt.transfer.from} → {proof.receipt.transfer.to} ·{" "}
              {formatAtomicUsdc(proof.receipt.transfer.value)} USDC
            </p>
          </div>

          <Separator />

          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <ShieldCheck className="size-3 text-primary" />
                PAYMENT-RESPONSE (decoded)
              </p>
              <JsonView value={proof.settlement} copyLabel="PAYMENT-RESPONSE" />
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <FileCheck2 className="size-3 text-primary" />
                Protected response body
              </p>
              <JsonView value={proof.responseBody} copyLabel="Protected response" />
            </div>
          </div>

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            This proof is held in browser memory for this session only. The chain record is
            permanent; clearing the view does not remove the transaction.
          </p>
        </div>
      ) : (
        <div className="p-5">
          <div className="rounded-2xl border-2 border-dashed border-border bg-secondary/20 px-5 py-8 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ReceiptText className="size-6" />
            </div>
            <h4 className="mt-3 text-base font-semibold text-foreground">No live transaction yet</h4>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
              A transaction hash, explorer link, receipt status, and paid amount appear here only
              after an approved live payment returns a verified settlement.
            </p>

            <div className="mx-auto mt-5 grid max-w-lg gap-2 text-left sm:grid-cols-2">
              <ChecklistItem text="Fund a payer wallet with Atlantic test USDC" />
              <ChecklistItem text="Fund the facilitator signer with PHRS" />
              <ChecklistItem text="Enable the gated server-side demo" />
              <ChecklistItem text="Run it, then verify the receipt" />
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button type="button" size="sm" onClick={() => openDemo("/data")} className="h-8 text-xs">
                Start gated demo
                <ArrowUpRight className="size-3.5" />
              </Button>
              <Button asChild variant="outline" size="sm" className="h-8 bg-transparent text-xs">
                <a href="#docs">Read the runbook</a>
              </Button>
            </div>

            <p className="mx-auto mt-4 max-w-md text-[10px] leading-relaxed text-muted-foreground">
              Local stub hashes and simulated receipts are never displayed here. Service health and
              a 402 challenge are also not proof of settlement.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

function ChecklistItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-card px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground">
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckCircle2 className="size-2.5" />
      </span>
      {text}
    </div>
  );
}

function ProofFact({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="flex items-center gap-1 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-bold text-foreground">{value}</p>
    </div>
  );
}

function Detail({ label, value, link, mono = false }: { label: string; value: string; link?: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-1">
        <p className={`truncate text-[11px] font-semibold text-foreground ${mono ? "font-mono" : ""}`}>
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
