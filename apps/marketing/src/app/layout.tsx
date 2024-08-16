import "./globals.css";

import type { Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { cn } from "@ctrlplane/ui";
import { Toaster } from "@ctrlplane/ui/toast";

import { Navbar } from "./Navbar";

export const metadata = {};
export const viewport: Viewport = {
  themeColor: [{ color: "black" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={cn(
          "min-h-screen bg-background font-sans text-foreground antialiased",
          GeistSans.variable,
          GeistMono.variable,
        )}
      >
        <Navbar />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
