"use client";

import { useRouter } from "next/navigation";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/react";

export const DeployButton: React.FC<{
  deploymentVersionId: string;
  environmentId: string;
  className?: string;
}> = ({ deploymentVersionId, environmentId, className }) => {
  const deploy = api.deployment.version.deploy.toEnvironment.useMutation();
  const router = useRouter();

  return (
    <Button
      className={cn(
        "w-full border-dashed border-neutral-700/60 bg-transparent text-center text-neutral-700 hover:border-blue-400 hover:bg-transparent hover:text-blue-400",
        className,
      )}
      variant="outline"
      size="sm"
      onClick={() =>
        deploy
          .mutateAsync({
            environmentId,
            versionId: deploymentVersionId,
          })
          .then(() => router.refresh())
      }
      disabled={deploy.isPending}
    >
      Deploy
    </Button>
  );
};
