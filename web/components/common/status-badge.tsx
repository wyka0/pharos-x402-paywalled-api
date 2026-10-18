import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

const toneClasses: Record<StatusTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  neutral: "border-border bg-muted text-muted-foreground",
  primary: "border-primary/20 bg-primary/10 text-primary",
};

const dotClasses: Record<StatusTone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-sky-500",
  neutral: "bg-muted-foreground",
  primary: "bg-primary",
};

export function StatusDot({
  tone = "neutral",
  pulse = false,
  className,
}: {
  tone?: StatusTone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2 rounded-full",
        dotClasses[tone],
        pulse && "animate-soft-pulse",
        className,
      )}
    />
  );
}

export function StatusBadge({
  label,
  tone = "neutral",
  pulse = false,
  className,
}: {
  label: string;
  tone?: StatusTone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 border px-2 py-0.5 font-medium", toneClasses[tone], className)}
    >
      <StatusDot tone={tone} pulse={pulse} />
      {label}
    </Badge>
  );
}
