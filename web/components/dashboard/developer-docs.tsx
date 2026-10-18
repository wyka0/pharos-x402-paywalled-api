"use client";

import {
  BookOpen,
  ExternalLink,
  KeyRound,
  LockKeyhole,
  Network,
  ServerCog,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import type { ReactNode } from "react";
import { CodeBlock } from "@/components/common/code-block";
import { CopyButton } from "@/components/common/copy-button";
import { SectionHeading } from "@/components/common/section-heading";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const quickstart = `# 1. Install backend and UI dependencies
npm install
npm --prefix web install

# 2. Configure local services (ignored by Git)
cp .env.example .env
cp web/.env.example web/.env.local

# 3. Start the facilitator, API, and UI in separate terminals
npm run start:facilitator   # http://127.0.0.1:4022
npm run start:api           # http://127.0.0.1:4021
npm run ui:dev              # http://localhost:3000

# 4. Optional: exercise the full protocol locally without a chain broadcast
npm run demo:local`;

const unpaidRequest = `# Inspect the real unpaid challenge
curl -i http://127.0.0.1:4021/data

# /health is free
curl -i http://127.0.0.1:4021/health

# The lower-priced paid route
curl -i http://127.0.0.1:4021/api/info`;

const paymentRequiredExample = `HTTP/1.1 402 Payment Required
Content-Type: application/json; charset=utf-8
PAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6Miwi... (base64 JSON)

# Decoded PAYMENT-REQUIRED
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": {
    "url": "http://127.0.0.1:4021/data",
    "description": "Premium dataset endpoint ($0.01 test USDC per request)",
    "mimeType": "application/json"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:688689",
      "asset": "0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B",
      "amount": "10000",
      "payTo": "0xYourReceivingAddress",
      "maxTimeoutSeconds": 120,
      "extra": { "name": "USDC", "version": "2" }
    }
  ]
}`;

const clientUsage = `// Node.js only. NEVER run this in browser JavaScript.
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(
  process.env.PAYER_PRIVATE_KEY as \`0x\${string}\`,
);

const client = new x402Client()
  .setSpendControls({
    allowedAssets: [{
      network: "eip155:688689",
      asset: "0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B",
      maxAmountPerPayment: "100000", // 0.10 test USDC safety cap
    }],
  })
  .register("eip155:688689", new ExactEvmScheme(account));

const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const response = await fetchWithPayment("http://127.0.0.1:4021/data");

console.log(response.status); // 200 after settlement
console.log(response.headers.get("PAYMENT-RESPONSE"));`;

const liveDemo = `# The CLI and the UI demo both require explicit approval.
# The server demo additionally requires PAYMENT_DEMO_ENABLED=YES
# and the manually entered PAYMENT_DEMO_APPROVAL_TOKEN.

# Fund the payer with Atlantic test USDC and the facilitator with PHRS first.
npm run demo

# The UI path:
# Header -> Run payment demo -> select route -> enter approval token
# -> check the confirmation box -> Run payment demo`;

const localEnv = `# Backend (.env, ignored)
PAY_TO_ADDRESS=0xYourReceivingAddress
FACILITATOR_URL=http://127.0.0.1:4022
FACILITATOR_PRIVATE_KEY_FILE=./.secrets/facilitator.key
PAYER_PRIVATE_KEY_FILE=./.secrets/payer.key
RPC_URL=https://atlantic.dplabs-internal.com

# Optional gated UI payment demo
PAYMENT_DEMO_ENABLED=NO
PAYMENT_DEMO_APPROVAL_TOKEN=
LIVE_PAYMENT_APPROVED=NO
PAYMENT_DEMO_API_URL=http://127.0.0.1:4021

# Web (web/.env.local, ignored)
API_ORIGIN=http://127.0.0.1:4021
FACILITATOR_ORIGIN=http://127.0.0.1:4022`;

const endpoints = [
  { method: "GET", path: "/health", price: "FREE", payment: "None", detail: "Liveness and network metadata." },
  { method: "GET", path: "/data", price: "$0.01", payment: "x402 exact", detail: "Premium sample dataset; 10,000 atomic test USDC." },
  { method: "GET", path: "/api/info", price: "$0.005", payment: "x402 exact", detail: "API metadata; 5,000 atomic test USDC." },
];

const networkRows = [
  ["Network identifier", "eip155:688689"],
  ["Chain ID", "688689"],
  ["RPC", "https://atlantic.dplabs-internal.com"],
  ["Explorer", "https://atlantic.pharosscan.xyz"],
  ["Test USDC", "0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B"],
  ["USDC name / version", "USDC / 2"],
  ["USDC decimals", "6"],
  ["Settlement scheme", "exact · EIP-3009"],
];

export function DeveloperDocs() {
  return (
    <section id="docs" className="scroll-mt-5 animate-slide-in-up space-y-4">
      <SectionHeading
        eyebrow="Developer documentation"
        title="Run it, inspect it, verify it"
        description="Endpoint reference, the real unpaid response, official client usage, and the network details a reviewer needs."
        action={
          <Badge variant="outline" className="border-primary/15 bg-primary/5 text-primary">
            <BookOpen className="size-3" />
            Reviewer-ready
          </Badge>
        }
      />

      <Card className="overflow-hidden p-0">
        <Tabs defaultValue="quickstart" className="gap-0">
          <div className="border-b bg-secondary/30 px-4 py-3">
            <TabsList className="h-9 w-full justify-start overflow-x-auto bg-card sm:w-fit">
              <TabsTrigger value="quickstart" className="gap-1.5 text-xs">
                <TerminalSquare className="size-3.5" />
                Quickstart
              </TabsTrigger>
              <TabsTrigger value="endpoints" className="gap-1.5 text-xs">
                <Network className="size-3.5" />
                Endpoints
              </TabsTrigger>
              <TabsTrigger value="client" className="gap-1.5 text-xs">
                <KeyRound className="size-3.5" />
                Payment client
              </TabsTrigger>
              <TabsTrigger value="network" className="gap-1.5 text-xs">
                <ServerCog className="size-3.5" />
                Network & security
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-4 sm:p-5">
            <TabsContent value="quickstart" className="mt-0 space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <Step number="01" title="Install" detail="Backend and web dependencies." />
                <Step number="02" title="Configure" detail="Ignored local .env files, no secrets in Git." />
                <Step number="03" title="Run" detail="Facilitator, API, and UI on local ports." />
              </div>
              <CodeBlock code={quickstart} title="local setup" language="bash" />
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-[11px] leading-relaxed text-emerald-950">
                <p className="font-semibold">The local demo is not a live payment.</p>
                <p className="mt-0.5 text-emerald-900/80">
                  <code className="font-mono">npm run demo:local</code> uses the real middleware and
                  official SDK against an in-memory signer. It never broadcasts and its hashes are
                  labelled as stubs.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="endpoints" className="mt-0 space-y-4">
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                      <TableHead>Method</TableHead>
                      <TableHead>Path</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="hidden md:table-cell">Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {endpoints.map((endpoint) => (
                      <TableRow key={endpoint.path}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px] text-primary">
                            {endpoint.method}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-[11px] font-semibold">{endpoint.path}</TableCell>
                        <TableCell className="font-semibold">{endpoint.price}</TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">{endpoint.payment}</TableCell>
                        <TableCell className="hidden text-[11px] text-muted-foreground md:table-cell">
                          {endpoint.detail}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <CodeBlock code={unpaidRequest} title="unpaid requests" language="bash" />
                <CodeBlock
                  code={paymentRequiredExample}
                  title="402 + decoded PAYMENT-REQUIRED"
                  language="http"
                />
              </div>
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                The 402 body is intentionally empty. The machine-readable requirements are in the
                base64 <code className="font-mono">PAYMENT-REQUIRED</code> header. A 402 is not a
                settlement and never includes protected data.
              </p>
            </TabsContent>

            <TabsContent value="client" className="mt-0 space-y-4">
              <CodeBlock code={clientUsage} title="official @x402/fetch client" language="ts" />
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border bg-card p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <LockKeyhole className="size-3.5 text-primary" />
                    Browser safety
                  </p>
                  <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    <li>No private key is bundled or sent to browser JavaScript.</li>
                    <li>The UI calls same-origin Next route handlers, which proxy to the API.</li>
                    <li>The payment demo is gated by two server opt-ins plus a manual token.</li>
                    <li>A local stub can never populate the transaction proof section.</li>
                  </ul>
                </div>
                <CodeBlock code={liveDemo} title="gated payment demo" language="bash" />
              </div>
              <CodeBlock code={localEnv} title=".env placeholders only" language="dotenv" />
            </TabsContent>

            <TabsContent value="network" className="mt-0 space-y-4">
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                      <TableHead>Parameter</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {networkRows.map(([label, value]) => (
                      <TableRow key={label}>
                        <TableCell className="text-[11px] text-muted-foreground">{label}</TableCell>
                        <TableCell className="break-all font-mono text-[11px] font-medium">
                          {value}
                        </TableCell>
                        <TableCell>
                          <CopyButton value={value} label={label} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <SecurityCard
                  icon={<ShieldCheck className="size-4" />}
                  title="Official SDK"
                  detail="ExactEvmScheme, x402ResourceServer, and x402Facilitator are used unchanged."
                />
                <SecurityCard
                  icon={<LockKeyhole className="size-4" />}
                  title="Server-side keys"
                  detail="Only the Express processes can read signing material. The UI never does."
                />
                <SecurityCard
                  icon={<ServerCog className="size-4" />}
                  title="Health ≠ settlement"
                  detail="Facilitator health and 402 challenges are shown separately from transaction proof."
                />
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-[11px] leading-relaxed text-amber-950">
                <p className="flex items-center gap-1.5 font-semibold">
                  <ExternalLink className="size-3.5" />
                  Deployment audit: Vercel is not assumed
                </p>
                <p className="mt-1 text-amber-900/80">
                  The Next UI can run on Vercel, but the Express API and facilitator need
                  long-running Node hosts. Point <code className="font-mono">API_ORIGIN</code> and{" "}
                  <code className="font-mono">FACILITATOR_ORIGIN</code> at public URLs. The current
                  settlement ledger is in-memory and single-instance; do not treat localhost or a
                  serverless filesystem as production-ready.
                </p>
              </div>

              <div className="rounded-xl border bg-secondary/30 p-3 text-[10px] leading-relaxed text-muted-foreground">
                Test USDC is an Atlantic Testnet asset with no real-world value. This page does not
                claim a live payment, deployment, or explorer proof unless one actually exists.
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </Card>
    </section>
  );
}

function Step({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="font-mono text-[10px] font-semibold text-primary">{number}</p>
      <p className="mt-1 text-xs font-semibold text-foreground">{title}</p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}

function SecurityCard({
  icon,
  title,
  detail,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <p className="mt-2 text-xs font-semibold text-foreground">{title}</p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}
