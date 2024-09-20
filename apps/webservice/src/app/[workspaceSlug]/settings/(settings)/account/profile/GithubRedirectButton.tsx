"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import { useRouter } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

export const GithubRedirectButton: React.FC<{
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
  githubUserId: string;
  workspace: Workspace | null;
}> = ({ variant, className, githubUserId, workspace }) => {
  const router = useRouter();

  return (
    <Button
      variant={variant}
      className={className}
      onClick={() =>
        workspace !== null &&
        router.push(`/${workspace.slug}/settings/workspace/integrations/github`)
      }
    >
      {githubUserId ? "Disconnect" : "Connect"}
    </Button>
  );
};
