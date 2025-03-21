import type { Metadata } from "next";

export const metadata: Metadata = { 
  title: "Resource Providers | Ctrlplane" 
};

export default function ProvidersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}