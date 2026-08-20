import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register Workspace | LogiFlow SaaS Onboarding",
  description:
    "Provision a dedicated, air-gapped logistics operations hub and super-admin command account.",
};

export default function RegisterLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}