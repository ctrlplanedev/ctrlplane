import _ from "lodash";
import { CheckCircle, Server, Shield } from "lucide-react";

import type { DeploymentVersion, Environment, ReleaseTarget } from "./types";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { rtid } from "./types";

type EnvironmentActionsPanelProps = {
  environment: Environment;
  versions: DeploymentVersion[];
  releaseTargets: ReleaseTarget[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const PoliciesSection: React.FC<{ policies: string[] }> = ({ policies }) => {
  if (policies.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Shield className="h-3.5 w-3.5" />
        Active Policies
      </div>
      <div className="flex flex-wrap gap-1">
        {policies.map((policy, i) => (
          <Badge key={i} variant="outline" className="py-0 text-[10px]">
            {policy}
          </Badge>
        ))}
      </div>
    </div>
  );
};

const ResourceItem: React.FC<{
  releaseTarget: ReleaseTarget;
  versions: DeploymentVersion[];
}> = ({ releaseTarget: rt }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center justify-between border-b px-2 py-1.5 last:border-b-0 hover:bg-muted/50">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-muted">
              <Server className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs">{rt.resource.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {rt.resource.kind}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5"></div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <div className="font-semibold">{rt.resource.name}</div>
          <div className="text-[11px]">
            Current: <span className="font-mono">v1</span>
          </div>
          <div className="text-[11px]">
            Desired: <span className="font-mono">v1</span>
          </div>
          <div className="text-[11px] text-blue-400">Update in progress</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

const VersionGroup: React.FC<{
  versionTag: string;
  resources: ReleaseTarget[];
  versions: DeploymentVersion[];
}> = ({ versionTag, resources, versions }) => {
  return (
    <div className="">
      {/* Version Header */}
      <div className="flex items-center justify-between rounded-t border border-b-0 bg-muted/30 px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-medium">{versionTag}</span>

          <Badge
            variant="outline"
            className="border-green-500/20 bg-green-500/10 py-0 text-[10px] text-green-600"
          >
            <CheckCircle className="mr-0.5 h-2.5 w-2.5" />
            Stable
          </Badge>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {resources.length} resource
          {resources.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Resource List */}
      <div className="rounded-b border border-t-0">
        {resources.map((rt) => (
          <ResourceItem key={rtid(rt)} releaseTarget={rt} versions={versions} />
        ))}
      </div>
    </div>
  );
};

const EmptyState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center rounded border border-dashed p-6 text-center">
      <Server className="mb-2 h-8 w-8 text-muted-foreground/50" />
      <p className="text-xs font-medium">No resources</p>
      <p className="text-[10px] text-muted-foreground">
        This environment has no deployed resources
      </p>
    </div>
  );
};

export const EnvironmentActionsPanel: React.FC<
  EnvironmentActionsPanelProps
> = ({ environment, versions, releaseTargets, open, onOpenChange }) => {
  // Filter release targets for this environment
  const envReleaseTargets = releaseTargets.filter(
    (rt) => rt.environment.id === environment.id,
  );

  // Group resources by current version
  const resourcesByVersion = _.groupBy(envReleaseTargets, () => "v1");

  // Calculate statistics
  const totalResources = envReleaseTargets.length;
  const upToDateCount = 0;
  const transitioningCount = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="text-base">{environment.name}</DialogTitle>
          <DialogDescription className="text-[10px]">
            {totalResources} resource{totalResources !== 1 ? "s" : ""} ·{" "}
            {upToDateCount} up to date ` · ${transitioningCount} updating`
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="max-h-[calc(85vh-120px)] overflow-y-auto px-4 pb-4">
          <div className="space-y-4">
            {/* Policies */}
            <PoliciesSection policies={environment.policies} />

            {/* Resources grouped by version */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Server className="h-3.5 w-3.5" />
                Resources by Version
              </div>

              {Object.entries(resourcesByVersion)
                .sort(([tagA], [tagB]) => tagB.localeCompare(tagA))
                .map(([versionTag, resources]) => (
                  <VersionGroup
                    key={versionTag}
                    versionTag={versionTag}
                    resources={resources}
                    versions={versions}
                  />
                ))}
            </div>

            {totalResources === 0 && <EmptyState />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
