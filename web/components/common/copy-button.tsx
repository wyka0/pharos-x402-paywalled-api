"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label = "Copy",
  className,
  size = "icon-sm",
}: {
  value: string;
  label?: string;
  className?: string;
  size?: "icon-sm" | "sm";
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Clipboard access was blocked by the browser");
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      onClick={copy}
      className={cn("shrink-0", className)}
      aria-label={label}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {size === "sm" && <span>{copied ? "Copied" : label}</span>}
    </Button>
  );
}
