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

import { api } from "~/trpc/react";

export const UnpinEnvFromVersionDialog: React.FC<{
  environment: { id: string; name: string };
  version: { id: string; tag: string };
  children: React.ReactNode;
}> = ({ environment, version, children }) => {
  const [open, setOpen] = useState(false);

  const unpinVersion =
    api.environment.versionPinning.unpinVersion.useMutation();
  const router = useRouter();

  const environmentId = environment.id;

  const onSubmit = () =>
    unpinVersion
      .mutateAsync({ environmentId })
      .then(() => router.refresh())
      .then(() => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Unpin {environment.name} from {version.tag}
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to unpin {environment.name} from {version.tag}
            ? This will deploy the latest valid version to this environment. You
            can also pin another version to this environment.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex justify-between sm:justify-between">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={onSubmit}>Unpin</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
