import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { capitalCase } from "change-case";

import { Badge } from "@ctrlplane/ui/badge";
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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrlplane/ui/hover-card";
import { Label } from "@ctrlplane/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { toast } from "@ctrlplane/ui/toast";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { api } from "~/trpc/react";

type Job = { id: string; status: JobStatus };

type ReleaseTarget = {
  id: string;
  resource: { id: string; name: string };
  latestJob?: Job;
};

const ALL_JOBS_STATUS = "all";

const useFilterByJobStatus = (releaseTargets: ReleaseTarget[]) => {
  const [selectedStatus, setSelectedStatus] = useState<
    JobStatus | typeof ALL_JOBS_STATUS
  >(ALL_JOBS_STATUS);
  const [filteredReleaseTargets, setFilteredReleaseTargets] =
    useState<ReleaseTarget[]>(releaseTargets);

  const onSelectStatus = (status: JobStatus | typeof ALL_JOBS_STATUS) => {
    setSelectedStatus(status);
    if (status === ALL_JOBS_STATUS) {
      setFilteredReleaseTargets(releaseTargets);
      return;
    }

    const filteredReleaseTargets = releaseTargets.filter(({ latestJob }) => {
      if (selectedStatus === ALL_JOBS_STATUS) return true;
      if (latestJob == null) return false;
      return latestJob.status === selectedStatus;
    });
    setFilteredReleaseTargets(filteredReleaseTargets);
  };

  return {
    selectedStatus,
    filteredReleaseTargets,
    onSelectStatus,
  };
};

const JobStatusSelector: React.FC<{
  value: JobStatus | typeof ALL_JOBS_STATUS;
  onChange: (value: JobStatus | typeof ALL_JOBS_STATUS) => void;
}> = ({ value, onChange }) => {
  return (
    <div className="space-y-2">
      <Label>Select jobs to override by status</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_JOBS_STATUS}>All statuses</SelectItem>
          {Object.values(JobStatus).map((status) => (
            <SelectItem key={status} value={status}>
              {capitalCase(status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const SelectedResourcesHoverList: React.FC<{
  releaseTargets: ReleaseTarget[];
}> = ({ releaseTargets }) => {
  const resources = releaseTargets.map(({ resource }) => resource);

  return (
    <HoverCard>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Redeploying to:</span>
        <HoverCardTrigger asChild>
          <Badge variant="secondary" className="h-7 text-xs">
            {resources.length} resources
          </Badge>
        </HoverCardTrigger>
      </div>
      <HoverCardContent className="w-80 p-2" align="center" side="right">
        <div className="flex flex-col gap-2">
          {resources.map((resource) => (
            <span
              key={resource.id}
              className="truncate text-sm text-muted-foreground"
            >
              {resource.name}
            </span>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

const useRedeployReleaseTargets = (
  environmentId: string,
  releaseTargetIds: string[],
  force: boolean,
  onClose?: () => void,
) => {
  const redeploy = api.redeploy.toEnvironment.useMutation();
  const router = useRouter();

  const handleRedeploy = () =>
    redeploy
      .mutateAsync({ environmentId, releaseTargetIds, force })
      .then(() => toast.success("Jobs queued successfully"))
      .then(() => router.refresh())
      .then(() => onClose?.());

  return { handleRedeploy, isPending: redeploy.isPending };
};

export const RedeployReleaseTargetsDialog: React.FC<{
  environment: { id: string };
  releaseTargets: ReleaseTarget[];
  children: React.ReactNode;
  onClose?: () => void;
}> = ({ environment, releaseTargets, children, onClose }) => {
  const [open, setOpen] = useState(false);
  const { selectedStatus, filteredReleaseTargets, onSelectStatus } =
    useFilterByJobStatus(releaseTargets);

  const { handleRedeploy, isPending } = useRedeployReleaseTargets(
    environment.id,
    filteredReleaseTargets.map(({ id }) => id),
    false,
    onClose,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose?.();
        setOpen(open);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="space-y-4" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Redeploy resources</DialogTitle>
          <DialogDescription>
            This will redeploy to the selected resources.
          </DialogDescription>
        </DialogHeader>

        <JobStatusSelector value={selectedStatus} onChange={onSelectStatus} />

        <SelectedResourcesHoverList releaseTargets={filteredReleaseTargets} />

        <DialogFooter className="flex justify-between sm:justify-between">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>

          <Button
            onClick={handleRedeploy}
            disabled={isPending || filteredReleaseTargets.length === 0}
          >
            Redeploy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ForceDeployReleaseTargetsDialog: React.FC<{
  environment: { id: string };
  releaseTargets: ReleaseTarget[];
  children: React.ReactNode;
  onClose?: () => void;
}> = ({ environment, releaseTargets, children, onClose }) => {
  const [open, setOpen] = useState(false);
  const { selectedStatus, filteredReleaseTargets, onSelectStatus } =
    useFilterByJobStatus(releaseTargets);

  const { handleRedeploy, isPending } = useRedeployReleaseTargets(
    environment.id,
    filteredReleaseTargets.map(({ id }) => id),
    true,
    onClose,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose?.();
        setOpen(open);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="space-y-4" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Force deploy resources</DialogTitle>
          <DialogDescription>
            Are you sure? This will force deploy to the selected resources.
          </DialogDescription>
        </DialogHeader>

        <JobStatusSelector value={selectedStatus} onChange={onSelectStatus} />

        <SelectedResourcesHoverList releaseTargets={filteredReleaseTargets} />

        <DialogFooter className="flex justify-between sm:justify-between">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>

          <Button
            variant="destructive"
            onClick={handleRedeploy}
            disabled={isPending || filteredReleaseTargets.length === 0}
          >
            Force deploy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
