import type * as schema from "@ctrlplane/db/schema";
import React, { useState } from "react";
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

export const PinVersionDialog: React.FC<{
  releaseTarget: ReleaseTarget;
  deploymentVersion: schema.DeploymentVersion;
  children: React.ReactNode;
}> = ({ releaseTarget, deploymentVersion, children }) => {
  const [open, setOpen] = useState(false);

  const pinVersion = api.releaseTarget.version.pin.useMutation();
  const utils = api.useUtils();
  const router = useRouter();

  const releaseTargetId = releaseTarget.id;
  const versionId = deploymentVersion.id;
  const onSubmit = () =>
    pinVersion
      .mutateAsync({ releaseTargetId, versionId })
      .then(() => setOpen(false))
      .then(() =>
        utils.releaseTarget.version.list.invalidate({ releaseTargetId }),
      )
      .then(() => router.refresh())
      .then(() =>
        toast.success(
          `Pinned ${releaseTarget.resource.name} to ${deploymentVersion.tag}`,
        ),
      )
      .catch(() =>
        toast.error(
          `Failed to pin ${releaseTarget.resource.name} to ${deploymentVersion.tag}`,
        ),
      );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {" "}
            Pin {releaseTarget.resource.name} to {deploymentVersion.tag}
          </DialogTitle>
          <DialogDescription>
            This will pin {releaseTarget.resource.name} to{" "}
            {deploymentVersion.tag} for all future releases until it is
            unpinned.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex justify-between sm:justify-between">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button disabled={pinVersion.isPending} onClick={onSubmit}>
            {pinVersion.isPending ? "Pinning..." : "Pin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const UnpinVersionDialog: React.FC<{
  releaseTarget: ReleaseTarget;
  currentPinnedVersion: schema.DeploymentVersion;
  children: React.ReactNode;
}> = ({ releaseTarget, currentPinnedVersion, children }) => {
  const [open, setOpen] = useState(false);

  const unpinVersion = api.releaseTarget.version.unpin.useMutation();
  const utils = api.useUtils();
  const router = useRouter();

  const releaseTargetId = releaseTarget.id;
  const onSubmit = () =>
    unpinVersion
      .mutateAsync({ releaseTargetId })
      .then(() => setOpen(false))
      .then(() =>
        utils.releaseTarget.version.list.invalidate({ releaseTargetId }),
      )
      .then(() => router.refresh())
      .then(() => toast.success(`Unpinned ${releaseTarget.resource.name}`))
      .catch(() =>
        toast.error(`Failed to unpin ${releaseTarget.resource.name}`),
      );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unpin {releaseTarget.resource.name}</DialogTitle>
          <DialogDescription>
            This will unpin {releaseTarget.resource.name} from{" "}
            {currentPinnedVersion.tag}. You can also pin this resource to
            another version.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex justify-between sm:justify-between">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button disabled={unpinVersion.isPending} onClick={onSubmit}>
            {unpinVersion.isPending ? "Unpinning..." : "Unpin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
