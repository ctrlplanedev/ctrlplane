import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Pause,
  XCircle,
} from "lucide-react";

import type { ReleaseTarget } from "./types";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

type DeploymentVersionStatus =
  | "unspecified"
  | "building"
  | "ready"
  | "failed"
  | "rejected";

type VersionCardProps = {
  version: {
    id: string;
    tag: string;
    status: DeploymentVersionStatus;
    createdAt: string;
  };
  currentReleaseTargets: ReleaseTarget[];
  desiredReleaseTargets: ReleaseTarget[];
  isSelected?: boolean;
  onSelect?: () => void;
};

const getVersionStatusColor = (status: DeploymentVersionStatus) => {
  switch (status) {
    case "ready":
      return "text-green-600 border-green-500/20";
    case "building":
      return "text-blue-600 border-blue-500/20";
    case "failed":
      return "text-red-600 border-red-500/20";
    case "rejected":
      return "text-amber-600 border-amber-500/20";
    default:
      return "text-gray-600 border-gray-500/20";
  }
};

const getVersionStatusIcon = (status: DeploymentVersionStatus) => {
  switch (status) {
    case "ready":
      return <CheckCircle2 className="h-4 w-4" />;
    case "building":
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case "failed":
      return <XCircle className="h-4 w-4" />;
    case "rejected":
      return <Pause className="h-4 w-4" />;
    default:
      return <AlertCircle className="h-4 w-4" />;
  }
};

export const VersionCard: React.FC<VersionCardProps> = ({
  version,
  currentReleaseTargets,
  desiredReleaseTargets: _desiredReleaseTargets,
  isSelected = false,
  onSelect,
}) => {
  const hasActiveDeployments = currentReleaseTargets.length > 0;

  const currentEnvironments = new Set(
    currentReleaseTargets.map((rt) => rt.environment.name),
  );

  if (!hasActiveDeployments) {
    return (
      <div
        onClick={onSelect}
        className={cn(
          "w-10 shrink-0 cursor-pointer rounded-md border bg-card p-3 text-sm text-muted-foreground transition-colors",
          isSelected
            ? "border-primary bg-primary/5 text-foreground ring-2 ring-primary/20"
            : "hover:border-primary/50 hover:text-foreground",
        )}
      >
        <div className="flex rotate-90 items-center font-mono">
          <span className="flex w-[150px] items-center gap-2 overflow-ellipsis">
            <span className="shrink-0">
              {getVersionStatusIcon(version.status)}
            </span>
            <span className="truncate">{version.tag}</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex shrink-0 cursor-pointer flex-col gap-2 rounded-md border bg-card p-3 text-sm transition-colors",
        "h-[175px] w-[180px]",
        isSelected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "hover:border-primary/50",
      )}
    >
      <div className="space-y-1">
        <div
          className={cn(
            "flex items-center gap-1 overflow-ellipsis font-mono font-semibold",
          )}
        >
          <span className={`mr-1 ${getVersionStatusColor(version.status)}`}>
            {getVersionStatusIcon(version.status)}
          </span>

          <span className="truncate">{version.tag}</span>
        </div>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Targets</span>
          <span className="font-medium">{currentReleaseTargets.length}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {Array.from(currentEnvironments).map((env) => (
          <Badge key={env} variant="outline" className="px-1.5 py-0 text-xs">
            {env}
          </Badge>
        ))}
      </div>

      <div className="mt-auto text-xs text-muted-foreground">
        {version.createdAt}
      </div>
    </div>
  );
};

export type { DeploymentVersionStatus };
