import {
  CheckCircle2Icon,
  CircleAlertIcon,
  CircleXIcon,
  PauseCircleIcon,
  PlayIcon,
  RocketIcon,
} from "lucide-react";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useWorkspace } from "~/components/WorkspaceProvider";

type VersionStatusDetailProps = {
  version: { id: string; status: string };
};

export const VersionStatusDetail: React.FC<VersionStatusDetailProps> = ({
  version,
}) => {
  const { workspace } = useWorkspace();
  const utils = trpc.useUtils();
  const updateStatus = trpc.deploymentVersions.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Version status updated");
      void utils.deploymentVersions.evaulate.invalidate();
    },
    onError: () => toast.error("Failed to update version status"),
  });

  const setReady = () =>
    updateStatus.mutate({
      workspaceId: workspace.id,
      versionId: version.id,
      status: "ready",
    });

  if (version.status === "ready") return null;

  if (version.status === "building") {
    return (
      <div className="flex w-full items-center gap-2">
        <div className="flex grow items-center gap-2">
          <CircleAlertIcon className="size-3 shrink-0 text-amber-500" />
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="truncate">Building · deployments disabled</span>
            </TooltipTrigger>
            <TooltipContent>
              Deployments are disabled until the version is ready
            </TooltipContent>
          </Tooltip>
        </div>
        <Button
          disabled={updateStatus.isPending}
          className="h-5 shrink-0 rounded-full bg-blue-500/10 px-2 text-xs text-blue-600 hover:bg-blue-500/20"
          onClick={setReady}
        >
          <RocketIcon className="size-3" />
          Mark Ready
        </Button>
      </div>
    );
  }

  if (version.status === "rejected") {
    return (
      <div className="flex w-full items-center gap-2">
        <div className="flex grow items-center gap-2">
          <CircleXIcon className="size-3 shrink-0 text-red-500" />
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="truncate">Rejected · will be removed</span>
            </TooltipTrigger>
            <TooltipContent>
              Existing deployments will be removed and no new deployments are
              allowed
            </TooltipContent>
          </Tooltip>
        </div>
        <Button
          disabled={updateStatus.isPending}
          className="h-5 shrink-0 rounded-full bg-green-500/10 px-2 text-xs text-green-600 hover:bg-green-500/20"
          onClick={setReady}
        >
          <CheckCircle2Icon className="size-3" />
          Unreject
        </Button>
      </div>
    );
  }

  if (version.status === "paused") {
    return (
      <div className="flex w-full items-center gap-2">
        <div className="flex grow items-center gap-2">
          <PauseCircleIcon className="size-3 shrink-0 text-amber-500" />
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="truncate">Paused · no new deployments</span>
            </TooltipTrigger>
            <TooltipContent>
              No new deployments allowed, existing deployments and rollbacks are
              unaffected
            </TooltipContent>
          </Tooltip>
        </div>
        <Button
          disabled={updateStatus.isPending}
          className="h-5 shrink-0 rounded-full bg-green-500/10 px-2 text-xs text-green-600 hover:bg-green-500/20"
          onClick={setReady}
        >
          <PlayIcon className="size-3" />
          Resume
        </Button>
      </div>
    );
  }

  return null;
};
