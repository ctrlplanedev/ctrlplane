import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconExternalLink } from "@tabler/icons-react";

import {
  auth,
  isCredentialsAuthEnabled,
  isGoogleAuthEnabled,
  isOIDCAuthEnabled,
} from "@ctrlplane/auth";
import { Button } from "@ctrlplane/ui/button";

import { LoginCard } from "./LoginCard";

export const metadata: Metadata = {
  title: "Sign in - Ctrlplane",
  description: "Sign in to your Ctrlplane account to manage your deployments.",
};

export default async function LoginPage() {
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

          {/* Only show signup button if credentials auth is enabled AND we're not exclusively using identity providers */}
          {isCredentialsAuthEnabled && (
            <Link href="/sign-up" passHref>
              <Button
                variant="outline"
                size="sm"
                className="border-border/40 bg-card/70 backdrop-blur-sm"
              >
                Create account
              </Button>
            </Link>
          )}
        </div>
      </header>

      <main className="flex min-h-[100vh] flex-col items-center justify-center pt-16">
        <LoginCard
          isCredentialsAuthEnabled={isCredentialsAuthEnabled}
          isGoogleEnabled={isGoogleAuthEnabled}
          isOidcEnabled={isOIDCAuthEnabled}
        />
      </main>

      <footer className="absolute bottom-0 left-0 right-0 p-4 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Ctrlplane. All rights reserved.</p>
      </footer>
    </>
  );
}
