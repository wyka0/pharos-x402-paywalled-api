import { SectionHeading } from "@/components/common/section-heading";
import { DeveloperDocs } from "@/components/dashboard/developer-docs";
import { PageShell } from "@/components/dashboard/page-shell";

export default function DocsPage() {
  return (
    <PageShell
      title="Run it, inspect it, verify it."
      description="Endpoint reference, the real unpaid response, official client usage, and the network details a reviewer needs."
    >
      <DeveloperDocs />
    </PageShell>
  );
}
