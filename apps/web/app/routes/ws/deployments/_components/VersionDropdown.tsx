import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { useState } from "react";
import { EllipsisIcon, Flag } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useDeployment } from "./DeploymentProvider";

type VersionStatus = WorkspaceEngine["schemas"]["DeploymentVersionStatus"];
type Version = { id: string; status: VersionStatus };

const useUpdateVersionStatus = (versionId: string) => {
  const { workspace } = useWorkspace();
  const { deployment } = useDeployment();
  const workspaceId = workspace.id;
  const deploymentId = deployment.id;
  const updateVersionStatus =
    trpc.deploymentVersions.updateStatus.useMutation();

  const utils = trpc.useUtils();
  const invalidateVersions = () =>
    utils.deployment.versions.invalidate({
      workspaceId,
      deploymentId,
    });

  const updateStatus = (status: VersionStatus) =>
    updateVersionStatus
      .mutateAsync({ workspaceId, versionId, status })
      .then(() => toast.success("Status update queued successfully"))
      .then(() => invalidateVersions());

  return { updateStatus, isPending: updateVersionStatus.isPending };
};

function VersionStatusDialog({
  version,
  children,
  onClose,
}: {
  version: Version;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const { updateStatus, isPending } = useUpdateVersionStatus(version.id);
  const [status, setStatus] = useState<VersionStatus>(version.status);
  const onClick = () => updateStatus(status).then(onClose);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Version Status</DialogTitle>
          <DialogDescription>
            Are you sure you want to update the status of this version? This
            will trigger a reevaluation of release targets.
          </DialogDescription>
        </DialogHeader>

        <Select
          value={status}
          onValueChange={(value) => setStatus(value as VersionStatus)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={onClick} disabled={isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VersionDropdown({ version }: { version: Version }) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <EllipsisIcon className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <VersionStatusDialog version={version} onClose={() => setOpen(false)}>
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex items-center gap-2"
          >
            <Flag className="h-4 w-4" />
            Update Status
          </DropdownMenuItem>
        </VersionStatusDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
