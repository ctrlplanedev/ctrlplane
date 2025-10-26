import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { useWorkspace } from "~/components/WorkspaceProvider";

type RedeployDialogProps = { releaseTarget: ReleaseTarget };

type ReleaseTarget = WorkspaceEngine["schemas"]["ReleaseTarget"];

const useRedeploy = (releaseTarget: ReleaseTarget, onClose: () => void) => {
  const { workspace } = useWorkspace();
  const redeploy = trpc.redeploy.releaseTarget.useMutation();
  const handleRedeploy = () =>
    redeploy
      .mutateAsync({ workspaceId: workspace.id, releaseTarget })
      .then(() => toast.success("Successfully queued redeploy"))
      .then(() => onClose())
      .catch((error) =>
        toast.error("Failed to queue redeploy", {
          description: error.message,
        }),
      );
  return { handleRedeploy, isPending: redeploy.isPending };
};

export function RedeployDialog({ releaseTarget }: RedeployDialogProps) {
  const [open, setOpen] = useState(false);
  const onClose = () => setOpen(false);
  const { handleRedeploy, isPending } = useRedeploy(releaseTarget, onClose);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Redeploy</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redeploy release target</DialogTitle>
          <DialogDescription>
            Are you sure you want to redeploy this release target?
            <pre>{JSON.stringify(releaseTarget, null, 2)}</pre>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleRedeploy} disabled={isPending}>
            Redeploy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
