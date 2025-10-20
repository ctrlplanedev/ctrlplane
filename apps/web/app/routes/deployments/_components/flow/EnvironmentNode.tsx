import type { NodeProps } from "reactflow";
import { Check, Loader2, ShieldAlert, X } from "lucide-react";
import { Handle, Position } from "reactflow";

import { Badge } from "~/components/ui/badge";
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

type EnvironmentNodeData = {
  id: string;
  name: string;
  resourceCount: number;
  jobs: Job[];
  currentVersionsWithCounts: Array<{ tag: string; count: number }>;
  desiredVersionsWithCounts: Array<{ tag: string; count: number }>;
  hasPolicyBlocks: boolean;
  blockedVersionsMap: Array<{ versionTag: string; reasons: string[] }>;
};

export const EnvironmentNode = ({ data }: NodeProps<EnvironmentNodeData>) => {
  const {
    name,
    resourceCount,
    jobs,
    currentVersionsWithCounts = [],
    desiredVersionsWithCounts = [],
    hasPolicyBlocks = false,
    blockedVersionsMap = [],
  } = data;

  const successCount = jobs.filter((j) => j.status === "successful").length;
  const failedCount = jobs.filter((j) => j.status === "failure").length;
  const inProgressCount = jobs.filter((j) => j.status === "inProgress").length;

  // Check if versions are changing
  const currentTags = currentVersionsWithCounts
    .map((v) => v.tag)
    .sort()
    .join(",");
  const desiredTags = desiredVersionsWithCounts
    .map((v) => v.tag)
    .sort()
    .join(",");
  const isTransitioning = currentTags !== desiredTags;

  return (
    <div className="min-w-[200px] rounded-lg border-2 border-primary/30 bg-card p-3 shadow-lg">
      <Handle
        type="target"
        position={Position.Left}
        className="h-3 w-3 !bg-primary"
      />
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">{name}</div>
          {hasPolicyBlocks && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ShieldAlert className="h-4 w-4 cursor-help text-amber-600" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <div className="space-y-2 text-xs">
                    <div className="font-semibold">Policy Blocks:</div>
                    {blockedVersionsMap.map((bv) => (
                      <div key={bv.versionTag} className="space-y-0.5">
                        <div className="font-mono font-medium">
                          {bv.versionTag}
                        </div>
                        <ul className="ml-2 space-y-0.5 text-muted-foreground">
                          {bv.reasons.map((reason, i) => (
                            <li key={i}>• {reason}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Version Display - Total Picture */}
        {currentVersionsWithCounts.length > 0 && (
          <div className="space-y-1">
            {!isTransitioning && currentVersionsWithCounts.length === 1 ? (
              // Single stable version - clean display
              <div className="font-mono text-xs text-muted-foreground">
                {currentVersionsWithCounts[0].tag}
              </div>
            ) : (
              // Complex state - show total picture
              <div className="space-y-1">
                {/* Current versions */}
                <div>
                  <div className="mb-0.5 text-[10px] text-muted-foreground">
                    Current:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {currentVersionsWithCounts.map((v) => (
                      <Badge
                        key={v.tag}
                        variant="outline"
                        className="px-1.5 py-0 font-mono text-xs"
                      >
                        {v.tag}
                        <span className="ml-1 text-muted-foreground">
                          ({v.count})
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Desired versions if different */}
                {isTransitioning && (
                  <div>
                    <div className="mb-0.5 text-[10px] text-blue-600">
                      Desired:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {desiredVersionsWithCounts.map((v) => (
                        <Badge
                          key={v.tag}
                          variant="outline"
                          className="border-blue-500/30 bg-blue-500/5 px-1.5 py-0 font-mono text-xs text-blue-600"
                        >
                          {v.tag}
                          <span className="ml-1">({v.count})</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          {resourceCount} {resourceCount === 1 ? "resource" : "resources"}
        </div>

        {/* Job Status */}
        {jobs.length > 0 && (
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
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="h-3 w-3 !bg-primary"
      />
    </div>
  );
};

export type { Job, JobStatus, EnvironmentNodeData };
