import type { ReactNode } from "react";
import { Header } from "@/components/dashboard/header";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Separator } from "@/components/ui/separator";

export function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="dashboard-atmosphere min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="min-h-screen p-3 md:p-4 lg:ml-64 lg:p-5">
        <div className="mx-auto max-w-[1680px] space-y-4 md:space-y-5">
          <Header title={title} description={description} />
          {children}

          <footer className="pb-4 pt-2">
            <Separator />
            <div className="flex flex-col gap-2 pt-4 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                <span className="font-semibold text-foreground">Pharos x402 Paywalled API</span> ·
                MediumPayments category · Task 6
              </p>
              <p className="flex flex-wrap items-center gap-2">
                <span>Testnet only</span>
                <span className="text-border">·</span>
                <span>No live payment is claimed without a verified receipt</span>
              </p>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
