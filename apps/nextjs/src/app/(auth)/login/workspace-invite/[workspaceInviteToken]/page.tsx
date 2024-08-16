import { redirect } from "next/navigation";
import { TbPlane } from "react-icons/tb";

import { auth } from "@ctrlplane/auth";
import { Button } from "@ctrlplane/ui/button";

import { LoginCard } from "../../LoginCard";

export default async function LoginInvitePage() {
  const session = await auth();
  if (session != null) redirect("/");
  return (
    <div className="h-full">
      <div className="flex items-center gap-2 p-4">
        <TbPlane className="text-2xl" />
        <div className="flex-grow" />
        <Button variant="ghost" className="text-muted-foreground">
          Contact
        </Button>
        <Button variant="outline">Sign up</Button>
      </div>
      <LoginCard />
    </div>
  );
}
