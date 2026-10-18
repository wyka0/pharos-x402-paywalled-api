import { SectionHeading } from "@/components/common/section-heading";
import { StatusBadge } from "@/components/common/status-badge";
import { FacilitatorStatus } from "@/components/dashboard/facilitator-status";
import { NetworkSnapshot } from "@/components/dashboard/network-snapshot";
import { PageShell } from "@/components/dashboard/page-shell";

export default function FacilitatorPage() {
  return (
    <PageShell
      title="Facilitator status."
      description="Verify and settle capabilities, signer metadata, and the live service state behind the resource API."
    >
      <section className="animate-slide-in-up space-y-4">
        <SectionHeading
          eyebrow="Protocol services"
          title="Self-hosted facilitator"
          description="The resource API delegates payment verification and on-chain settlement to this service."
          action={<StatusBadge label="Service health" tone="info" />}
        />
        <div className="grid gap-3 lg:grid-cols-[1.55fr_0.75fr]">
          <FacilitatorStatus />
          <NetworkSnapshot />
        </div>
      </section>
    </PageShell>
  );
}
