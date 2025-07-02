import type React from "react";
import { useState } from "react";

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

import { api } from "~/trpc/react";

export const PinEnvToVersionDialog: React.FC<{
  environment: { id: string; name: string };
  version: { id: string; tag: string; deploymentId: string };
  children: React.ReactNode;
}> = ({ environment, version, children }) => {
  const [open, setOpen] = useState(false);

  const pinVersion = api.environment.versionPinning.pinVersion.useMutation();
  const utils = api.useUtils();

  const environmentId = environment.id;
  const versionId = version.id;
  const invalidatePinnedVersions = () =>
    utils.environment.versionPinning.pinnedVersions.invalidate({
      environmentId,
      deploymentId: version.deploymentId,
    });

  const onSubmit = () =>
    pinVersion
      .mutateAsync({ environmentId, versionId })
      .then(() => setOpen(false))
      .then(() => invalidatePinnedVersions());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Pin {environment.name} to {version.tag}
          </DialogTitle>
          <DialogDescription>
            This will pin {environment.name} to {version.tag} for all future
            releases until it is unpinned.
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
