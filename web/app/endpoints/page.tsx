import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { SectionHeading } from "@/components/common/section-heading";
import { EndpointPricing } from "@/components/dashboard/endpoint-pricing";
import { PageShell } from "@/components/dashboard/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function EndpointsPage() {
  return (
    <PageShell
      title="Endpoint pricing."
      description="Three routes, two paid prices, one free health check. Prices are enforced in atomic test USDC with 6 decimals."
    >
      <section className="animate-slide-in-up space-y-4">
        <SectionHeading
          eyebrow="Pricing"
          title="What each route costs"
          description="Every paid route returns the same machine-readable 402 challenge before data is released."
          action={
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
              Test USDC only
            </Badge>
          }
        />
        <EndpointPricing />
      </section>

      <Card className="animate-slide-in-up flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Ready to inspect the real flow?</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            The API explorer sends live unpaid requests through the server proxy and decodes the
            actual <code className="font-mono">PAYMENT-REQUIRED</code> header.
          </p>
        </div>
        <Button asChild className="h-9 shrink-0 text-xs">
          <Link href="/explorer?endpoint=data">
            Open the API explorer
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </Card>
    </PageShell>
  );
}
