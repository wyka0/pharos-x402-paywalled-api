import { SectionHeading } from "@/components/common/section-heading";
import { Badge } from "@/components/ui/badge";
import { TransactionProof } from "@/components/dashboard/transaction-proof";
import { PageShell } from "@/components/dashboard/page-shell";

export default function ProofPage() {
  return (
    <PageShell
      title="Transaction proof."
      description="Only a real settlement may appear here. Service health, a 402 challenge, or a local stub is never treated as proof."
    >
      <section className="animate-slide-in-up space-y-4">
        <SectionHeading
          eyebrow="Evidence"
          title="On-chain settlement record"
          description="A transaction hash, PharosScan link, receipt status, and paid amount appear only after an approved live payment returns a verified settlement."
          action={
            <Badge variant="outline" className="border-border bg-card text-muted-foreground">
              Receipt required
            </Badge>
          }
        />
        <TransactionProof />
      </section>
    </PageShell>
  );
}
