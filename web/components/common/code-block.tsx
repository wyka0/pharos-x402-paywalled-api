import { CopyButton } from "@/components/common/copy-button";
import { cn } from "@/lib/utils";

export function CodeBlock({
  code,
  title,
  language,
  className,
}: {
  code: string;
  title?: string;
  language?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[oklch(0.28_0.03_155)] bg-[oklch(0.16_0.018_155)] text-[oklch(0.94_0.01_155)] shadow-lg shadow-black/10",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2 rounded-full bg-[oklch(0.68_0.16_25)]" />
            <span className="size-2 rounded-full bg-[oklch(0.8_0.14_85)]" />
            <span className="size-2 rounded-full bg-[oklch(0.68_0.14_150)]" />
          </span>
          <span className="truncate font-mono text-[11px] text-white/60">
            {title ?? language ?? "shell"}
          </span>
        </div>
        <CopyButton
          value={code}
          label="Snippet"
          className="text-white/60 hover:bg-white/10 hover:text-white"
        />
      </div>
      <pre className="code-scroll overflow-x-auto px-4 py-4 text-[12px] leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}
