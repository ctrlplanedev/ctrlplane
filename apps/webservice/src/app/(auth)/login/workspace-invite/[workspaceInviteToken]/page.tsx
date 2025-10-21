import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  auth,
  isCredentialsAuthEnabled,
  isGoogleAuthEnabled,
  isOIDCAuthEnabled,
} from "@ctrlplane/auth/server";
import { Button } from "@ctrlplane/ui/button";

import { LoginCard } from "../../LoginCard";

export const metadata: Metadata = { title: "Ctrlplane Login" };

export default async function WorkflowInvitePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session != null) redirect("/");

  return (
    <>
      <div className="absolute left-0 right-0 top-0 flex items-center gap-2 p-4">
        <Image
          src="/android-chrome-192x192.png"
          alt="Ctrlplane Logo"
          width={32}
          height={32}
        />
        <div className="flex-grow" />
        <Link href="https://discord.gg/sUmH9NyWhp" passHref>
          <Button variant="ghost" className="text-muted-foreground">
            Contact
          </Button>
        </Link>
        {isCredentialsAuthEnabled && (
          <Link href="/sign-up" passHref>
            <Button variant="outline">Sign up</Button>
          </Link>
        )}
      </div>
      <div className="flex h-[100vh] flex-col items-center justify-center">
        <LoginCard
          isCredentialsAuthEnabled={isCredentialsAuthEnabled}
          isGoogleEnabled={isGoogleAuthEnabled}
          isOidcEnabled={isOIDCAuthEnabled}
        />
      </div>
    </>
  );
}
