import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconPlane } from "@tabler/icons-react";

import {
  auth,
  isCredentialsAuthEnabled,
  isGoogleAuthEnabled,
  isOIDCAuthEnabled,
} from "@ctrlplane/auth";
import { Button } from "@ctrlplane/ui/button";

import { LoginCard } from "../../LoginCard";

export const metadata: Metadata = { title: "Ctrlplane Login" };

export default async function LoginInvitePage() {
  const session = await auth();
  if (session != null) redirect("/");

  return (
    <div className="h-full">
      <div className="flex items-center gap-2 p-4">
        <IconPlane className="h-10 w-10" />
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
      <LoginCard
        isCredentialsAuthEnabled={isCredentialsAuthEnabled}
        isGoogleEnabled={isGoogleAuthEnabled}
        isOidcEnabled={isOIDCAuthEnabled}
      />
    </div>
  );
}
