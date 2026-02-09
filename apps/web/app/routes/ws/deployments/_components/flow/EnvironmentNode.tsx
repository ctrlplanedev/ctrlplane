import type { NodeProps } from "reactflow";
import { Check, Loader2, ShieldAlert, X } from "lucide-react";
import { useSearchParams } from "react-router";
import { Handle, Position } from "reactflow";

import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

type JobStatus =
  | "cancelled"
  | "skipped"
  | "inProgress"
  | "actionRequired"
  | "pending"
  | "failure"
  | "invalidJobAgent"
  | "invalidIntegration"
  | "externalRunNotFound"
  | "successful";

type Job = {
  id: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
};

type VersionWithCount = {
  name: string;
  tag: string;
  count: number;
};

type EnvironmentNodeData = {
  id: string;
  name: string;
  resourceCount: number;
  jobs: Job[];
  currentVersionsWithCounts: Array<VersionWithCount>;
  desiredVersionsWithCounts: Array<VersionWithCount>;
  blockedVersionsByVersionId?: Record<string, Array<{ reason: string }>>;
  isLoading?: boolean;
  onSelect?: () => void;
};

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-3 w-16" />
  </div>
);

const JobStatusBadges: React.FC<{ jobs: Job[] }> = ({ jobs }) => {
  const successCount = jobs.filter((j) => j.status === "successful").length;
  const failedCount = jobs.filter((j) => j.status === "failure").length;
  const inProgressCount = jobs.filter((j) => j.status === "inProgress").length;

  if (jobs.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {successCount > 0 && (
        <Badge className="border-green-500/20 bg-green-500/10 px-1 py-0 text-xs text-green-600">
          {successCount} <Check />
        </Badge>
      )}
      {inProgressCount > 0 && (
        <Badge className="border-blue-500/20 bg-blue-500/10 px-1 py-0 text-xs text-blue-600">
          {inProgressCount} <Loader2 className="animate-spin" />
        </Badge>
      )}
      {failedCount > 0 && (
        <Badge className="border-red-500/20 bg-red-500/10 px-1 py-0 text-xs text-red-600">
          {failedCount} <X />
        </Badge>
      )}
    </div>
  );
};


const VersionDisplay: React.FC<{
  currentVersions: VersionWithCount[];
  desiredVersions: VersionWithCount[];
}> = ({ currentVersions, desiredVersions }) => {
  if (currentVersions.length === 0) return null;

  const currentTags = currentVersions.map((v) => v.tag).sort().join(",");
  const desiredTags = desiredVersions.map((v) => v.tag).sort().join(",");
  const isTransitioning = currentTags !== desiredTags;

  // Single stable version - clean display
  if (!isTransitioning && currentVersions.length === 1) {
    return (
      <div className="font-mono text-xs text-muted-foreground">
        {currentVersions[0]?.name || currentVersions[0]?.tag}
      </div>
    );
  }

  // Complex state - show current and desired
  return (
    <div className="space-y-1">
      <div>
        <div className="mb-0.5 text-[10px] text-muted-foreground">Current:</div>
        <div className="flex flex-wrap gap-1">
          {currentVersions.map((v) => (
            <Badge
              key={v.tag}
              variant="outline"
              className="px-1.5 py-0 font-mono text-xs"
            >
              {v.name || v.tag}
              <span className="ml-1 text-muted-foreground">({v.count})</span>
            </Badge>
          ))}
        </div>
      </div>

      {isTransitioning && (
        <div>
          <div className="mb-0.5 text-[10px] text-blue-600">Desired:</div>
          <div className="flex flex-wrap gap-1">
            {desiredVersions.map((v) => (
              <Badge
                key={v.tag}
                variant="outline"
                className="border-blue-500/30 bg-blue-500/5 px-1.5 py-0 font-mono text-xs text-blue-600"
              >
                {v.name || v.tag}
                <span className="ml-1">({v.count})</span>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PolicyBlockIndicator: React.FC<{ reasons: Array<{ reason: string }> }> = ({
  reasons,
}) => {
  if (reasons.length === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="absolute -left-2 top-1/2 -translate-x-full -translate-y-1/2 bg-primary-foreground">
            <div className="flex h-5 w-5 cursor-help items-center justify-center rounded-full border-2 border-amber-600 bg-amber-500/20 shadow-sm">
              <ShieldAlert className="h-3 w-3 text-amber-600" />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <div className="space-y-1 text-xs">
            <div className="font-semibold">Why this version is blocked:</div>
            <ul className="ml-2 space-y-0.5">
              {reasons.map((block, i) => (
                <li key={i}>• {block.reason}</li>
              ))}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const EnvironmentNode: React.FC<NodeProps<EnvironmentNodeData>> = ({
  data,
}) => {
  const {
    name,
    resourceCount,
    jobs,
    currentVersionsWithCounts = [],
    desiredVersionsWithCounts = [],
    blockedVersionsByVersionId = {},
    isLoading = false,
    onSelect,
  } = data;

  const [searchParams] = useSearchParams();
  const selectedVersionId = searchParams.get("version");

  const blockedReasons = selectedVersionId
    ? (blockedVersionsByVersionId[selectedVersionId] ?? [])
    : [];

  return (
    <div
      className="min-w-[200px] cursor-pointer rounded-lg border-2 border-primary/30 bg-card p-3 shadow-lg transition-all hover:border-primary/50 hover:shadow-xl"
      onClick={onSelect}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="h-3 w-3 bg-primary!"
      />

      <PolicyBlockIndicator reasons={blockedReasons} />

      <div className="space-y-2">
        <div className="text-sm font-semibold">{name}</div>

        {isLoading && (<LoadingSkeleton />)}
        {!isLoading && (
          <>
            <VersionDisplay
              currentVersions={currentVersionsWithCounts}
              desiredVersions={desiredVersionsWithCounts}
            />

            <div className="text-xs text-muted-foreground">
              {resourceCount} {resourceCount === 1 ? "resource" : "resources"}
            </div>

            <JobStatusBadges jobs={jobs} />
          </>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="h-3 w-3 bg-primary!"
      />
    </div>
  );
};

export type { Job, JobStatus, EnvironmentNodeData };
