import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find Your Workspace | LogiFlow",
  description:
    "Enter your unique corporate company identifier slug to access your secure administrative logistics cockpit.",
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}