import "./globals.css";
import "reactflow/dist/base.css";
import "./react-flow.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "./react-grid-layout.css";

import type { Viewport } from "next";
import { headers } from "next/headers";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { auth } from "@ctrlplane/auth";
import { cn } from "@ctrlplane/ui";
import { Toaster } from "@ctrlplane/ui/toast";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata = {
  title: { default: "Ctrlplane" },
};
export const viewport: Viewport = {
  themeColor: [{ color: "black" }],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={cn(
          "min-h-screen bg-background font-sans text-foreground antialiased",
          GeistSans.variable,
          GeistMono.variable,
        )}
      >
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <Toaster />
      </body>
    </html>
  );
}
