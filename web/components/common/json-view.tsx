import { CopyButton } from "@/components/common/copy-button";
import { cn } from "@/lib/utils";

export function JsonView({
  value,
  className,
  copyLabel = "JSON",
}: {
  value: unknown;
  className?: string;
  copyLabel?: string;
}) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? "null";
  return (
    <div className={cn("relative", className)}>
      <div className="absolute right-1.5 top-1.5 z-10">
        <CopyButton value={text} label={copyLabel} />
      </div>
      <pre className="code-scroll max-h-[28rem] overflow-auto rounded-xl bg-foreground px-4 py-4 pr-12 font-mono text-[12px] leading-relaxed text-background">
        <code>{text}</code>
      </pre>
    </div>
  );
}
