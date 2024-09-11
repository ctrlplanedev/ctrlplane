"use client";

import { useRouter } from "next/navigation";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";

import { api } from "../../../../../trpc/react";

export const DeployButton: React.FC<{
  releaseId: string;
  environmentId: string;
}> = ({ releaseId, environmentId }) => {
  const deploy = api.release.deploy.toEnvironment.useMutation();
  const router = useRouter();

  return (
    <Button
      className={cn(
        "w-full border-dashed border-neutral-800/50 bg-transparent text-center text-neutral-800 hover:border-blue-400 hover:bg-transparent hover:text-blue-400",
      )}
      variant="outline"
      size="sm"
      onClick={async (e) => {
        e.preventDefault();

        await deploy.mutateAsync({
          environmentId,
          releaseId,
        });

        router.refresh();
      }}
      disabled={deploy.isPending}
    >
      Deploy
    </Button>
  );
};
