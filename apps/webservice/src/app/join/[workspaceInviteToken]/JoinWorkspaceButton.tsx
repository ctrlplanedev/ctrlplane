"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import { useRouter } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/react";

export const JoinWorkspaceButton: React.FC<{
  workspace: Workspace;
  token: string;
}> = ({ workspace, token }) => {
  const accept = api.workspace.invite.token.accept.useMutation();
  const router = useRouter();
  const handleJoinWorkspace = async () => {
    await accept.mutateAsync(token);
    router.push(`/${workspace.slug}`);
  };
  return (
    <Button className="w-full" onClick={handleJoinWorkspace}>
      Join Workspace
    </Button>
  );
};
