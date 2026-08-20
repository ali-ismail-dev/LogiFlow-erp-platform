import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Buffer } from "buffer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

/**
 * Premium LogiFlow brand mark as an embedded base64 SVG data URI.
 * The icon represents interlinked cargo nodes and a radar telemetry arrow,
 * styled with crisp emerald-400 and cyan-400 gradient elements on a deep black surface.
 */
const logiFlowFaviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="lfGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="#09090b"/>
  <circle cx="32" cy="32" r="24" fill="none" stroke="url(#lfGradient)" stroke-width="2" stroke-dasharray="4 4" opacity="0.6"/>
  <circle cx="32" cy="32" r="16" fill="none" stroke="url(#lfGradient)" stroke-width="2" opacity="0.8"/>
  <circle cx="32" cy="32" r="6" fill="url(#lfGradient)" opacity="0.9"/>
  <path d="M32 32 L46 18" stroke="url(#lfGradient)" stroke-width="3" stroke-linecap="round"/>
  <circle cx="46" cy="18" r="5" fill="#34d399" stroke="#09090b" stroke-width="1.5"/>
  <path d="M32 32 L18 38" stroke="url(#lfGradient)" stroke-width="3" stroke-linecap="round"/>
  <circle cx="18" cy="38" r="5" fill="#22d3ee" stroke="#09090b" stroke-width="1.5"/>
</svg>`;

const logiFlowFaviconDataUri = `data:image/svg+xml;base64,${Buffer.from(logiFlowFaviconSvg).toString("base64")}`;

export const metadata: Metadata = {
  title: "LogiFlow | Multi-Tenant B2B Enterprise Resource Planning Platform",
  description:
    "Real-time fleet optimization, multi-tenant cargo routing, and instant telemetry telemetry cockpit control panels.",
  icons: {
    icon: logiFlowFaviconDataUri,
    shortcut: logiFlowFaviconDataUri,
    apple: logiFlowFaviconDataUri,
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.className} bg-zinc-950 text-zinc-50 antialiased min-h-screen selection:bg-cyan-500/30 selection:text-cyan-200`}
      >
        {children}
      </body>
    </html>
  );
}