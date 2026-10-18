import { PageShell } from "@/components/dashboard/page-shell";
import { Overview } from "@/components/dashboard/overview";

export default function OverviewPage() {
  return (
    <PageShell
      title="The pay-per-request API layer for Pharos agents."
      description="Discover a 402 challenge, authorize test USDC, and receive protected data only after the facilitator settles on Pharos Atlantic Testnet."
    >
      <Overview />
    </PageShell>
  );
}
