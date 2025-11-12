import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { Copy, EllipsisIcon, Trash } from "lucide-react";
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
import { useWorkspace } from "~/components/WorkspaceProvider";

function CopyJobAgentIdAction({ jobAgentId }: { jobAgentId: string }) {
  const [, copyToClipboard] = useCopyToClipboard();
  const handleCopy = () => {
    copyToClipboard(jobAgentId);
    toast.success("Job agent ID copied to clipboard");
  };

  return (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        handleCopy();
      }}
    >
      <Copy className="h-4 w-4" />
      Copy job agent ID
    </DropdownMenuItem>
  );
}

function useDeleteJobAgent() {
  const { workspace } = useWorkspace();
  const { mutateAsync, isPending } = trpc.jobAgents.delete.useMutation();

  const handleDelete = (jobAgentId: string) =>
    mutateAsync({ workspaceId: workspace.id, jobAgentId }).then(() =>
      toast.success("Job agent deletion queued successfully"),
    );

  return { handleDelete, isPending };
}

function DeleteJobAgentAction({ jobAgentId }: { jobAgentId: string }) {
  const { handleDelete, isPending } = useDeleteJobAgent();
  const onClick = () => handleDelete(jobAgentId);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Trash className="h-4 w-4 text-red-500" />
          Delete job agent
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete job agent</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this job agent? This action cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={onClick} disabled={isPending}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type JobAgent = WorkspaceEngine["schemas"]["JobAgent"];
export function JobAgentActions({ jobAgent }: { jobAgent: JobAgent }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="h-6 w-6">
          <EllipsisIcon className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <CopyJobAgentIdAction jobAgentId={jobAgent.id} />
        <DeleteJobAgentAction jobAgentId={jobAgent.id} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
