import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { useState } from "react";
import { Copy, TriangleAlert } from "lucide-react";
import { capitalCase } from "change-case";
import { EllipsisIcon } from "lucide-react";
import { useCopyToClipboard } from "react-use";
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

const JOB_STATUSES = [
  "cancelled",
  "skipped",
  "inProgress",
  "actionRequired",
  "pending",
  "failure",
  "invalidJobAgent",
  "invalidIntegration",
  "externalRunNotFound",
  "successful",
] as const;

function CopyJobIdAction({
  jobId,
  onClose,
}: {
  jobId: string;
  onClose: () => void;
}) {
  const [, copyToClipboard] = useCopyToClipboard();
  const handleCopy = () => {
    copyToClipboard(jobId);
    toast.success("Job ID copied to clipboard");
    onClose();
  };

  return (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        handleCopy();
      }}
      className="flex items-center gap-2"
    >
      <Copy className="h-4 w-4" />
      Copy job ID
    </DropdownMenuItem>
  );
}

function UpdateJobStatusAction({
  jobId,
  currentStatus,
  onClose,
}: {
  jobId: string;
  currentStatus: WorkspaceEngine["schemas"]["JobStatus"];
  onClose: () => void;
}) {
  const { workspace } = useWorkspace();
  const [status, setStatus] =
    useState<WorkspaceEngine["schemas"]["JobStatus"]>(currentStatus);

  const updateJobMutation = trpc.jobs.updateStatus.useMutation();
  const onClick = () =>
    updateJobMutation
      .mutateAsync({ workspaceId: workspace.id, jobId, status })
      .then(() => toast.success("Job status update queued successfully"))
      .then(() => onClose());

  return (
    <Dialog>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <TriangleAlert className="h-4 w-4" />
          Override status
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override job status</DialogTitle>
          <DialogDescription>
            Override the status of this job.
          </DialogDescription>
        </DialogHeader>

        <Select
          value={status}
          onValueChange={(value) =>
            setStatus(value as WorkspaceEngine["schemas"]["JobStatus"])
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a status" />
          </SelectTrigger>
          <SelectContent align="start">
            {JOB_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {capitalCase(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={onClick} disabled={updateJobMutation.isPending}>
            Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function JobActions({
  job,
}: {
  job: WorkspaceEngine["schemas"]["JobWithRelease"];
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="h-6 w-6">
          <EllipsisIcon className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <CopyJobIdAction jobId={job.job.id} onClose={() => setOpen(false)} />
        <UpdateJobStatusAction
          jobId={job.job.id}
          currentStatus={job.job.status}
          onClose={() => setOpen(false)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
