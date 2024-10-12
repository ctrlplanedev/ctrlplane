import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { IconPlane } from "@tabler/icons-react";

import { auth } from "@ctrlplane/auth";
import { Button } from "@ctrlplane/ui/button";

import { env } from "~/env";
import { LoginCard } from "./LoginCard";

export const metadata: Metadata = { title: "Ctrlplane Login" };

export default async function LoginPage() {
  const session = await auth();
  if (session != null) redirect("/");
  const isOidcEnabled = env.AUTH_OIDC_CLIENT_ID != null;
  const isGoogleEnabled = env.AUTH_GOOGLE_CLIENT_ID != null;
  return (
    <div className="h-full">
      <div className="flex items-center gap-2 p-4">
        <IconPlane className="h-10 w-10" />
        <div className="flex-grow" />
        <Button variant="ghost" className="text-muted-foreground">
          Contact
        </Button>
        <Button variant="outline">Sign up</Button>
      </div>
      <LoginCard
        isGoogleEnabled={isGoogleEnabled}
        isOidcEnabled={isOidcEnabled}
      />
    </div>
  );
}
