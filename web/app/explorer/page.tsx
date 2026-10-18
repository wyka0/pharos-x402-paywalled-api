import { SectionHeading } from "@/components/common/section-heading";
import { StatusBadge } from "@/components/common/status-badge";
import { ApiExplorer } from "@/components/dashboard/api-explorer";
import { PageShell } from "@/components/dashboard/page-shell";
import { endpointById, type EndpointId } from "@/lib/types";

export default async function ExplorerPage({
  searchParams,
}: {
  searchParams: Promise<{ endpoint?: string }>;
}) {
  const params = await searchParams;
  const requested = params.endpoint ?? "data";
  const initialEndpoint: EndpointId = endpointById(requested) ? (requested as EndpointId) : "data";

  return (
    <PageShell
      title="Inspect the real HTTP flow."
      description="Send unpaid requests through the server proxy. A 402 is the expected response for paid routes; protected data appears only after a verified settlement."
    >
      <section className="animate-slide-in-up space-y-4">
        <SectionHeading
          eyebrow="Interactive"
          title="API explorer"
          description="Real requests, real status codes, real headers. Nothing here is mocked or replayed."
          action={<StatusBadge label="Live proxy" tone="primary" />}
        />
        <ApiExplorer initialEndpoint={initialEndpoint} />
      </section>
    </PageShell>
  );
}
