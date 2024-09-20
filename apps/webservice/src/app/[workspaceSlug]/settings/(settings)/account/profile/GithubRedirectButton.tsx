"use client";

import type { ButtonProps } from "@ctrlplane/ui/button";
import { useRouter } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

export function GithubRedirectButton({
  variant,
  className,
  githubUserId,
}: {
  variant: ButtonProps["variant"];
  className: string;
  githubUserId: string;
}) {
  const router = useRouter();
  return (
    <Button
      variant={variant}
      className={className}
      onClick={() => {
        router.push("../workspace/integrations/github");
      }}
    >
      {githubUserId == "" ? "Connect" : "Disconnect"}
    </Button>
  );
}
