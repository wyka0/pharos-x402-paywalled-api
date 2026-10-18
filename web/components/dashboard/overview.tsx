import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Coins,
  CreditCard,
  Network,
  PenLine,
  Send,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/common/status-badge";
import { PaymentDemoTrigger } from "@/components/payment/payment-demo-trigger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const stats = [
  {
    label: "Live network",
    value: "Atlantic",
    detail: "eip155:688689",
    icon: Network,
    primary: true,
  },
  {
    label: "Paid routes",
    value: "2",
    detail: "one free health route",
    icon: CreditCard,
    primary: false,
  },
  {
    label: "Price range",
    value: "$0.005–$0.01",
    detail: "test USDC per call",
    icon: Coins,
    primary: false,
  },
  {
    label: "Settlement",
    value: "x402 exact",
    detail: "EIP-3009 · 6 decimals",
    icon: ShieldCheck,
    primary: false,
  },
];

const steps = [
  {
    title: "Request",
    detail: "A client asks for a protected resource.",
    icon: Send,
  },
  {
    title: "402 challenge",
    detail: "The API returns PAYMENT-REQUIRED with the price.",
    icon: ShieldAlert,
  },
  {
    title: "Sign & retry",
    detail: "The client signs a test USDC authorization and retries.",
    icon: PenLine,
  },
  {
    title: "Verify & settle",
    detail: "The facilitator settles on Pharos and returns a receipt.",
    icon: CheckCircle2,
  },
];

export function Overview() {
  return (
    <section id="overview" className="animate-slide-in-up space-y-3 md:space-y-4">
      <Card className="overflow-hidden border-0 p-0 shadow-xl shadow-primary/5">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <div className="hero-mesh relative overflow-hidden p-6 text-primary-foreground md:p-8">
            <div className="surface-grid absolute inset-0 opacity-30" aria-hidden="true" />
            <div className="relative">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge className="border-white/20 bg-white/10 text-white backdrop-blur">
                  <BadgeCheck className="size-3" />
                  x402 exact scheme
                </Badge>
                <Badge className="border-white/15 bg-white/5 text-white/80 backdrop-blur">
                  Testnet only
                </Badge>
              </div>
              <h2 className="max-w-xl text-balance text-2xl font-bold leading-tight tracking-tight md:text-4xl">
                Pay only for the data you actually use.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80 md:text-base">
                Pharos x402 Paywalled API turns ordinary HTTP endpoints into pay-per-request
                APIs. Clients discover a 402 challenge, authorize test USDC, and retry. The
                facilitator verifies the authorization and settles it on Pharos Atlantic Testnet.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  asChild
                  className="h-9 bg-white text-primary shadow-lg shadow-black/10 transition-all duration-300 hover:scale-[1.02] hover:bg-white/90"
                >
                  <Link href="/endpoints">
                    Explore endpoints
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-9 border-white/25 bg-white/5 text-white transition-all duration-300 hover:scale-[1.02] hover:bg-white/15 hover:text-white"
                >
                  <Link href="/docs">Read the flow</Link>
                </Button>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-white/70">
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-300" />
                  Official x402 SDK
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-300" />
                  EIP-3009 authorization
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-300" />
                  Self-hosted facilitator
                </span>
              </div>
            </div>
          </div>

          <div className="relative bg-card p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Request lifecycle
                </p>
                <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                  From 402 to receipt
                </h3>
              </div>
              <StatusBadge label="Illustrative" tone="neutral" className="text-[9px]" />
            </div>
            <Separator className="my-4" />
            <ol className="space-y-3.5">
              {steps.map((step, index) => (
                <li key={step.title} className="group flex items-start gap-3">
                  <div className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                    <step.icon className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      <span className="mr-1.5 font-mono text-[10px] text-muted-foreground">
                        0{index + 1}
                      </span>
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {step.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-5 rounded-xl border border-primary/10 bg-primary/5 p-3">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">No accounts, no subscriptions.</span>{" "}
                The payment is the credential. Protected data is returned only after settlement.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card
            key={stat.label}
            style={{ animationDelay: `${index * 90}ms` }}
            className={`animate-slide-in-up cursor-default p-4 transition-all duration-500 ease-out hover:scale-[1.02] hover:shadow-xl ${
              stat.primary
                ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-card shadow-sm hover:border-primary/20"
            }`}
          >
            <div className="mb-3 flex items-start justify-between">
              <p className={`text-xs font-medium ${stat.primary ? "text-white/80" : "text-muted-foreground"}`}>
                {stat.label}
              </p>
              <div
                className={`flex size-6 items-center justify-center rounded-full transition-transform duration-300 hover:rotate-12 ${
                  stat.primary ? "bg-white/15 text-white" : "bg-primary/10 text-primary"
                }`}
              >
                <stat.icon className="size-3" />
              </div>
            </div>
            <p className={`text-2xl font-bold tracking-tight ${stat.primary ? "text-white" : "text-foreground"}`}>
              {stat.value}
            </p>
            <p className={`mt-1 text-[11px] ${stat.primary ? "text-white/70" : "text-muted-foreground"}`}>
              {stat.detail}
            </p>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed sm:items-center">
          <Coins className="mt-0.5 size-3.5 shrink-0 sm:mt-0" />
          <span>
            <span className="font-semibold">Testnet tokens have no real value.</span> Prices use
            Atlantic test USDC with 6 ERC-20 decimals, not the 18-decimal native gas token.
          </span>
        </p>
        <PaymentDemoTrigger compact />
      </div>
    </section>
  );
}
