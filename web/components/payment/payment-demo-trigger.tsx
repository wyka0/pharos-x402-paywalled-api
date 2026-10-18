"use client";

import { ArrowUpRight } from "lucide-react";
import { usePaymentDemo } from "@/components/payment/payment-demo-provider";
import { Button } from "@/components/ui/button";

export function PaymentDemoTrigger({ compact = false }: { compact?: boolean }) {
  const { openDemo } = usePaymentDemo();

  return (
    <Button
      onClick={() => openDemo()}
      className="h-9 gap-1.5 bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-300 hover:scale-[1.02] hover:bg-primary/90"
      size={compact ? "sm" : "default"}
    >
      Run payment demo
      <ArrowUpRight className="size-3.5" />
    </Button>
  );
}
