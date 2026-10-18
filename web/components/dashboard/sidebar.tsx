"use client";

import {
  BookOpen,
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  ReceiptText,
  ServerCog,
  TerminalSquare,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
import { StatusBadge, StatusDot } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const workspaceItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/endpoints", label: "Endpoint pricing", icon: CreditCard },
  { href: "/explorer", label: "API explorer", icon: TerminalSquare },
  { href: "/proof", label: "Transaction proof", icon: ReceiptText },
];

const protocolItems = [
  { href: "/facilitator", label: "Facilitator", icon: ServerCog },
  { href: "/docs", label: "Developer docs", icon: BookOpen },
];

export function Sidebar({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex w-64 flex-col border-border bg-card p-4",
        mobile ? "h-full border-r-0" : "fixed left-0 top-0 h-screen overflow-y-auto border-r",
      )}
    >
      <Link
        href="/"
        onClick={onNavigate}
        className="group mb-6 flex items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BrandLogo />
      </Link>

      <nav className="space-y-5" aria-label="Dashboard sections">
        <NavGroup label="Workspace" items={workspaceItems} pathname={pathname} onNavigate={onNavigate} />
        <NavGroup label="Protocol" items={protocolItems} pathname={pathname} onNavigate={onNavigate} />
      </nav>

      <div className="mt-auto pt-6">
        <Separator className="mb-4" />
        <div className="rounded-xl border bg-secondary/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StatusDot tone="success" pulse />
              <p className="text-xs font-semibold text-foreground">Atlantic Testnet</p>
            </div>
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[9px] font-semibold text-emerald-700"
            >
              TESTNET
            </Badge>
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">eip155:688689</p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            Test USDC only. No real-world value.
          </p>
          <a
            href="https://docs.pharos.xyz/getting-started/token-registry"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
          >
            Token registry <ExternalLink className="size-2.5" />
          </a>
        </div>
        <div className="mt-3 flex items-center justify-between px-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            MediumPayments · Task 6
          </span>
          <StatusBadge label="x402" tone="primary" className="px-1.5 py-0 text-[9px]" />
        </div>
      </div>
    </aside>
  );
}

function NavGroup({
  label,
  items,
  pathname,
  onNavigate,
}: {
  label: string;
  items: Array<{ href: string; label: string; icon: typeof LayoutDashboard }>;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div>
      <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-300",
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:translate-x-0.5 hover:bg-secondary hover:text-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {isActive && <span className="ml-auto size-1.5 rounded-full bg-primary-foreground/80" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
