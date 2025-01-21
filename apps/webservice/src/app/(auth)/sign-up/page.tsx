import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconPlane } from "@tabler/icons-react";

import { auth, isCredentialsAuthEnabled } from "@ctrlplane/auth";
import { Button } from "@ctrlplane/ui/button";

import { SignUpCard } from "./SignUpCard";

export const metadata: Metadata = { title: "Ctrlplane Login" };

export default async function LoginPage() {
  if (!isCredentialsAuthEnabled) redirect("/login");

  const session = await auth();
  if (session != null) redirect("/");

  return (
    <div className="h-full">
      <div className="flex items-center gap-2 p-4">
        <IconPlane className="h-10 w-10" />
        <div className="flex-grow" />
        <Button variant="ghost" className="text-muted-foreground">
          Contact
        </Button>
        <Link href="/login" passHref>
          <Button variant="outline" className="bg-transparent">
            Login
          </Button>
        </Link>
      </div>
      <SignUpCard />
    </div>
  );
}
