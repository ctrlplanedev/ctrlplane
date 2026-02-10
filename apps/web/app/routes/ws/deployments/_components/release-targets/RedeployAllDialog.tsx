import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { useState } from "react";
import { toast } from "sonner";

import type { JobStatus } from "../types";
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
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "~/components/ui/hover-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "~/components/ui/select";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { JobStatusDisplayName } from "../../../_components/JobStatusBadge";

type ReleaseTarget = WorkspaceEngine["schemas"]["ReleaseTargetSummary"];

function useRedeployAll(releaseTargets: ReleaseTarget[]) {
  const { workspace } = useWorkspace();
  const redeployAll = trpc.redeploy.releaseTargets.useMutation();

  const handleRedeployAll = () =>
    redeployAll
      .mutateAsync({
        workspaceId: workspace.id,
        releaseTargets: releaseTargets.map((rt) => ({
          ...rt.releaseTarget,
        })),
      })
      .then(() => toast.success("Successfully queued redeploy"));

  return { handleRedeployAll, isPending: redeployAll.isPending };
}

function StatusSelector({
  status,
  setStatus,
}: {
  status: JobStatus | "all";
  setStatus: (status: JobStatus | "all") => void;
}) {
  return (
    <Select
      value={String(status)}
      onValueChange={(value) => setStatus(value as JobStatus | "all")}
    >
      <SelectTrigger>
        {status === "all" ? "All statuses" : JobStatusDisplayName[status]}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        {Object.keys(JobStatusDisplayName).map((status) => (
          <SelectItem key={status} value={status}>
            {JobStatusDisplayName[status as keyof typeof JobStatusDisplayName]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SelectedTargetsHover({
  selectedTargets,
}: {
  selectedTargets: ReleaseTarget[];
}) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="cursor-pointer text-sm text-green-500 hover:text-green-400"
        >
          {selectedTargets.length} resources selected
        </Button>
      </HoverCardTrigger>
      <HoverCardContent className="p-2">
        <div className="flex flex-col gap-1 text-sm">
          {selectedTargets.map((rt) => (
            <div key={rt.releaseTarget.resourceId}>
              <span>{rt.resource.name}</span>
            </div>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function RedeployAllDialog({
  releaseTargets,
}: {
  releaseTargets: ReleaseTarget[];
}) {
  const [open, setOpen] = useState(false);

  const environmentName = releaseTargets[0]?.environment.name ?? "";
  const [status, setStatus] = useState<JobStatus | "all">("all");
  const selectedTargets = releaseTargets.filter(
    (rt) => status === "all" || rt.latestJob?.status === status,
  );
  const { handleRedeployAll, isPending } = useRedeployAll(selectedTargets);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          className="h-6 w-fit rounded-sm border border-neutral-200 px-2 py-3 text-xs dark:border-neutral-700"
        >
          Redeploy {environmentName}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {" "}
            Redeploy all release targets in {environmentName}{" "}
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to redeploy all release targets?
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <StatusSelector status={status} setStatus={setStatus} />
          {selectedTargets.length > 0 && (
            <SelectedTargetsHover selectedTargets={selectedTargets} />
          )}
          {selectedTargets.length === 0 && (
            <span className="text-sm text-muted-foreground">
              No resources selected
            </span>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={handleRedeployAll}
            disabled={isPending || selectedTargets.length === 0}
          >
            Redeploy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
