import type * as schema from "@ctrlplane/db/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import { toast } from "@ctrlplane/ui/toast";

import type { ReleaseTarget } from "../types";
import { api } from "~/trpc/react";

export const ForceDeployVersion: React.FC<{
  releaseTarget: ReleaseTarget;
  deploymentVersion: schema.DeploymentVersion;
  children: React.ReactNode;
}> = ({ releaseTarget, deploymentVersion, children }) => {
  const [open, setOpen] = useState(false);
  const forceDeploy = api.releaseTarget.version.forceDeploy.useMutation();
  const utils = api.useUtils();
  const router = useRouter();

  const invalidate = () =>
    utils.releaseTarget.version.list.invalidate({ releaseTargetId });

  const releaseTargetId = releaseTarget.id;
  const versionId = deploymentVersion.id;
  const onSubmit = () =>
    forceDeploy
      .mutateAsync({ releaseTargetId, versionId })
      .then(() => setOpen(false))
      .then(() => router.refresh())
      .then(() => invalidate())
      .then(() =>
        toast.success(`Force deployed ${releaseTarget.resource.name}`),
      )
      .catch(() =>
        toast.error(`Failed to force deploy ${releaseTarget.resource.name}`),
      );

  const resourceName = releaseTarget.resource.name;
  const versionTag = deploymentVersion.tag;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Force deploy {versionTag} to {resourceName}
          </DialogTitle>
          <DialogDescription>
            Are you sure? This will force deploy {versionTag} to {resourceName}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex w-full justify-between sm:justify-between">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={forceDeploy.isPending}
            onClick={onSubmit}
          >
            {forceDeploy.isPending ? "Force deploying..." : "Force deploy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
