import "./globals.css";
import "reactflow/dist/base.css";
import "./react-flow.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "./react-grid-layout.css";

import type { Viewport } from "next";
import dynamic from "next/dynamic";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { auth } from "@ctrlplane/auth";
import { cn } from "@ctrlplane/ui";
import { Toaster } from "@ctrlplane/ui/toast";

import { TRPCReactProvider } from "~/trpc/react";
import SessionProvider from "./SessionProvider";

const OpenReplay = dynamic(() => import("./openreplay"), { ssr: false });

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
  const session = await auth();
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={cn(
          "min-h-screen bg-background font-sans text-foreground antialiased",
          GeistSans.variable,
          GeistMono.variable,
        )}
      >
        <OpenReplay userId={session?.user.id} />
        <SessionProvider session={session}>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </SessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
