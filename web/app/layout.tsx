import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { PaymentDemoProvider } from "@/components/payment/payment-demo-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Pharos x402 Paywalled API",
  description:
    "A reviewer-facing demo of pay-per-request HTTP APIs settled with x402 on Pharos Atlantic Testnet.",
  applicationName: "Pharos x402 Paywalled API",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "Pharos x402 Paywalled API",
    description:
      "Pay-per-request APIs with HTTP 402, test USDC, and on-chain settlement on Pharos Atlantic Testnet.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7faf7",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="pharos-x402-theme"
        >
          <PaymentDemoProvider>
            {children}
            <Toaster position="bottom-right" />
          </PaymentDemoProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
