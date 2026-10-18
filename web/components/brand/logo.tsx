import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative flex size-9 shrink-0 items-center justify-center rounded-[0.85rem] bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform duration-300 group-hover:scale-105">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="size-5"
        >
          <path
            d="M5.8 17.2V7.4L12 13.3l6.2-5.9v9.8"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="18.6" cy="5.7" r="2.1" fill="currentColor" opacity="0.9" />
        </svg>
        <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-emerald-300 ring-2 ring-card" />
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold leading-tight tracking-tight text-foreground">
            Pharos <span className="text-primary">x402</span>
          </p>
          <p className="truncate text-[10px] font-semibold leading-tight tracking-[0.08em] text-foreground/80">
            Paywalled API
          </p>
        </div>
      )}
    </div>
  );
}
