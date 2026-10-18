import { BookOpen, Network } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/common/status-badge";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { PaymentDemoTrigger } from "@/components/payment/payment-demo-trigger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Header({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="animate-slide-in-up space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MobileNav />
          <Badge
            variant="outline"
            className="hidden border-primary/15 bg-primary/5 px-2.5 py-1 font-mono text-[10px] font-medium tracking-tight text-primary sm:inline-flex"
          >
            pharos-x402-paywalled-api
          </Badge>
          <StatusBadge label="Atlantic Testnet" tone="success" pulse className="text-[10px]" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            variant="outline"
            className="h-9 bg-transparent text-xs transition-all duration-300 hover:scale-[1.02] hover:shadow-md"
          >
            <Link href="/docs">
              <BookOpen className="size-3.5" />
              Docs
            </Link>
          </Button>
          <PaymentDemoTrigger />
        </div>
      </div>

      <div className="max-w-3xl">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
          <Network className="size-3.5 text-primary" />
          <span className="font-mono">eip155:688689</span>
          <span className="text-border">/</span>
          <span>Pay-per-request API</span>
        </div>
        <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground md:text-3xl lg:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          {description}
        </p>
      </div>
    </header>
  );
}
