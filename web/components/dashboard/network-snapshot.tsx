import { ArrowUpRight, Coins, ExternalLink, Network, ShieldCheck } from "lucide-react";
import { CopyButton } from "@/components/common/copy-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const TOKEN = "0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B";

export function NetworkSnapshot() {
  return (
    <Card className="h-full p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            Network snapshot
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-foreground">
            Atlantic Testnet
          </h3>
        </div>
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[9px] font-semibold text-emerald-700">
          TESTNET
        </Badge>
      </div>

      <div className="mt-4 space-y-3">
        <Row label="Network" value="eip155:688689" mono />
        <Row label="Chain ID" value="688689" mono />
        <Row label="Scheme" value="exact · EIP-3009" />
        <Row label="USDC decimals" value="6 (ERC-20)" />
      </div>

      <Separator className="my-4" />

      <div className="rounded-xl border bg-secondary/30 p-3">
        <div className="flex items-center justify-between gap-1">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Coins className="size-3 text-primary" />
            Test USDC
          </p>
          <CopyButton value={TOKEN} label="Token address" />
        </div>
        <p className="mt-1 break-all font-mono text-[10px] leading-relaxed text-foreground">
          {TOKEN}
        </p>
        <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
          Official Pharos Token Registry address. Test funds only; no real-world value.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        <a
          href={`https://atlantic.pharosscan.xyz/address/${TOKEN}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-[11px] font-medium text-foreground transition-all duration-300 hover:border-primary/30 hover:bg-secondary/40"
        >
          <span className="flex items-center gap-1.5">
            <Network className="size-3.5 text-primary" />
            View token on PharosScan
          </span>
          <ExternalLink className="size-3 text-muted-foreground" />
        </a>
        <a
          href="https://docs.pharos.xyz/getting-started/token-registry"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-[11px] font-medium text-foreground transition-all duration-300 hover:border-primary/30 hover:bg-secondary/40"
        >
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-primary" />
            Official token registry
          </span>
          <ArrowUpRight className="size-3 text-muted-foreground" />
        </a>
      </div>
    </Card>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`text-right text-[11px] font-semibold text-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
