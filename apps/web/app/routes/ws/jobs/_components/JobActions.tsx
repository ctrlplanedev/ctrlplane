import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { useState } from "react";
import { capitalCase } from "change-case";
import { Copy, EllipsisIcon, Network, TriangleAlert } from "lucide-react";
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
import { buildTraceTree } from "../../deployments/_components/trace-utils";
import { TraceTree } from "../../deployments/_components/TraceTree";

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

function ViewTraceAction({
  jobId,
  onClose,
}: {
  jobId: string;
  onClose: () => void;
}) {
  const { workspace } = useWorkspace();
  const [selectedSpanId, setSelectedSpanId] = useState<string>();

  // First, fetch spans with the job_id to get the trace_id
  const jobSpansQuery = trpc.deploymentTraces.byJobId.useQuery({
    workspaceId: workspace.id,
    jobId,
    limit: 1,
    offset: 0,
  });

  // Get the trace ID from the first span
  const traceId = jobSpansQuery.data?.[0]?.traceId;

  // Then fetch all spans for that trace (including planning/eligibility phases)
  const fullTraceQuery = trpc.deploymentTraces.byTraceId.useQuery(
    {
      workspaceId: workspace.id,
      traceId: traceId!,
    },
    {
      enabled: !!traceId,
    },
  );

  const isLoading = jobSpansQuery.isLoading || fullTraceQuery.isLoading;
  const isError = jobSpansQuery.isError || fullTraceQuery.isError;
  const error = jobSpansQuery.error ?? fullTraceQuery.error;

  const spans = fullTraceQuery.data ?? [];
  const treeNodes = buildTraceTree(spans);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Network className="h-4 w-4" />
          View trace
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="max-w-5xl! max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Job Trace</DialogTitle>
          <DialogDescription>
            View the complete execution trace for this job from reconciliation
            start
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              Loading traces...
            </div>
          ) : isError ? (
            <div className="flex h-32 items-center justify-center text-sm text-red-500">
              Error loading traces: {error?.message}
            </div>
          ) : !traceId ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No traces found for this job
            </div>
          ) : spans.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No trace spans found
            </div>
          ) : (
            <TraceTree
              nodes={treeNodes}
              onSpanSelect={(span) => setSelectedSpanId(span.spanId)}
              selectedSpanId={selectedSpanId}
            />
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={() => onClose()}>
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function JobActions({
  job,
}: {
  job: WorkspaceEngine["schemas"]["Job"];
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
        <CopyJobIdAction jobId={job.id} onClose={() => setOpen(false)} />
        <ViewTraceAction jobId={job.id} onClose={() => setOpen(false)} />
        <UpdateJobStatusAction
          jobId={job.id}
          currentStatus={job.status}
          onClose={() => setOpen(false)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
