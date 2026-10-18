import { ArrowUpRight, Check, Coins, LockKeyhole, Zap } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ENDPOINT_LIST, type EndpointMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

export function EndpointPricing() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {ENDPOINT_LIST.map((endpoint, index) => (
        <PriceCard key={endpoint.id} endpoint={endpoint} delay={index * 90} />
      ))}
    </div>
  );
}

function PriceCard({ endpoint, delay }: { endpoint: EndpointMeta; delay: number }) {
  const isPrimary = endpoint.id === "data";
  const isFree = !endpoint.paid;

  return (
    <Card
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "animate-slide-in-up relative overflow-hidden p-5 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-xl",
        isPrimary
          ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
          : "bg-card hover:border-primary/25",
      )}
    >
      {isPrimary && (
        <div className="surface-grid pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />
      )}
      <div className="relative">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn(
                "px-1.5 py-0 font-mono text-[10px]",
                isPrimary
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-primary/15 bg-primary/5 text-primary",
              )}
            >
              GET
            </Badge>
            <code
              className={cn(
                "font-mono text-xs font-semibold",
                isPrimary ? "text-white" : "text-foreground",
              )}
            >
              {endpoint.path}
            </code>
          </div>
          {isFree ? (
            <Badge className="border-emerald-200 bg-emerald-50 text-[9px] font-semibold text-emerald-700" variant="outline">
              FREE
            </Badge>
          ) : (
            <Badge
              className={cn(
                "text-[9px] font-semibold",
                isPrimary
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-primary/15 bg-primary/5 text-primary",
              )}
              variant="outline"
            >
              {endpoint.id === "data" ? "MOST POPULAR" : "LOW COST"}
            </Badge>
          )}
        </div>

        <div className="flex items-end gap-1.5">
          <p
            className={cn(
              "text-3xl font-bold tracking-tight",
              isPrimary ? "text-white" : "text-foreground",
            )}
          >
            {isFree ? "Free" : `$${endpoint.priceUsd}`}
          </p>
          {!isFree && (
            <span className={cn("pb-1 text-[11px]", isPrimary ? "text-white/70" : "text-muted-foreground")}>
              test USDC
            </span>
          )}
        </div>
        <p className={cn("mt-1 text-[11px]", isPrimary ? "text-white/70" : "text-muted-foreground")}>
          {isFree ? "No payment required" : `${endpoint.priceAtomic} atomic units · 6 decimals`}
        </p>

        <p
          className={cn(
            "mt-3 min-h-[2.5rem] text-xs leading-relaxed",
            isPrimary ? "text-white/80" : "text-muted-foreground",
          )}
        >
          {endpoint.description}
        </p>

        <div
          className={cn(
            "mt-4 flex items-center gap-1.5 border-t pt-3 text-[10px]",
            isPrimary ? "border-white/15 text-white/70" : "border-border text-muted-foreground",
          )}
        >
          {isFree ? (
            <>
              <Zap className="size-3" />
              Returns network metadata immediately
            </>
          ) : (
            <>
              <LockKeyhole className="size-3" />
              402 challenge · settled before data
            </>
          )}
        </div>

        <Button
          asChild
          variant={isPrimary ? "secondary" : "outline"}
          className={cn(
            "mt-4 h-8 w-full text-xs transition-all duration-300 hover:scale-[1.01]",
            isPrimary
              ? "bg-white text-primary hover:bg-white/90"
              : "bg-transparent hover:bg-secondary",
          )}
        >
          <Link href={`/explorer?endpoint=${endpoint.id}`}>
            {isFree ? (
              <>
                <Check className="size-3.5" />
                Inspect free route
              </>
            ) : (
              <>
                Inspect paid route
                <ArrowUpRight className="size-3.5" />
              </>
            )}
          </Link>
        </Button>

        {!isFree && (
          <p className={cn("mt-2 flex items-center justify-center gap-1 text-[9px]", isPrimary ? "text-white/50" : "text-muted-foreground")}>
            <Coins className="size-2.5" />
            Test USDC only · no real value
          </p>
        )}
      </div>
    </Card>
  );
}
