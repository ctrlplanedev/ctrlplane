"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import { useRouter } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { urls } from "~/app/urls";

export const GithubRedirectButton: React.FC<{
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
  githubUserId: string;
  workspace: Workspace;
}> = ({ variant, className, githubUserId, workspace }) => {
  const router = useRouter();

  return (
    <Button
      variant={variant}
      className={className}
      onClick={() =>
        router.push(
          `${urls.workspace(workspace.slug).settings().integrations()}/github`,
        )
      }
    >
      {githubUserId ? "Disconnect" : "Connect"}
    </Button>
  );
};
