import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconExternalLink } from "@tabler/icons-react";

import { auth } from "@ctrlplane/auth/server";
import { Button } from "@ctrlplane/ui/button";

import { SignUpCard } from "./SignUpCard";

export const metadata: Metadata = {
  title: "Create Account - Ctrlplane",
  description:
    "Create a free Ctrlplane account to start managing your deployments.",
};

export default async function SignUpPage() {
  // if (!isCredentialsAuthEnabled) redirect("/login");

  const session = await auth.api.getSession({ headers: await headers() });
  if (session != null) redirect("/");

  return (
    <>
      <header className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-card/70 backdrop-blur-sm">
            <Image
              src="/android-chrome-192x192.png"
              alt="Ctrlplane Logo"
              width={28}
              height={28}
            />
          </div>
          <span className="hidden font-medium sm:inline-block">Ctrlplane</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="https://docs.ctrlplane.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <span>Documentation</span>
            <IconExternalLink className="ml-1 h-3 w-3" />
          </Link>

          <Link href="/login" passHref>
            <Button
              variant="outline"
              size="sm"
              className="border-border/40 bg-card/70 backdrop-blur-sm"
            >
              Sign in
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex min-h-[100vh] flex-col items-center justify-center pt-16">
        <SignUpCard />
      </main>

      <footer className="absolute bottom-0 left-0 right-0 p-4 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Ctrlplane. All rights reserved.</p>
      </footer>
    </>
  );
}
