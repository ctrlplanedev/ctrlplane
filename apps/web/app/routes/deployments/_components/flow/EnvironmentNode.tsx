import type { NodeProps } from "reactflow";
import { Check, Loader2, ShieldAlert, X } from "lucide-react";
import { useSearchParams } from "react-router";
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
  blockedVersionsByVersionId?: Record<string, Array<{ reason: string }>>; // All blocked versions with reasons
};

export const EnvironmentNode = ({ data }: NodeProps<EnvironmentNodeData>) => {
  const {
    name,
    resourceCount,
    jobs,
    currentVersionsWithCounts = [],
    desiredVersionsWithCounts = [],
    blockedVersionsByVersionId = {},
  } = data;

  // Get selected version from URL params
  const [searchParams] = useSearchParams();
  const selectedVersionId = searchParams.get("version");

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

  // Get blocked reasons for the selected version
  const blockedVersionsForSelected = selectedVersionId
    ? (blockedVersionsByVersionId[selectedVersionId] ?? [])
    : [];

  // Show policy blocks only when a version is selected and it's blocked
  const showPolicyBlocks =
    selectedVersionId && blockedVersionsForSelected.length > 0;

  return (
    <div className="min-w-[200px] rounded-lg border-2 border-primary/30 bg-card p-3 shadow-lg">
      {/* Target Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="h-3 w-3 !bg-primary"
      />

      {/* Policy Block Indicator on Handle */}
      {showPolicyBlocks && (
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
                <div className="font-semibold">
                  Why this version is blocked:
                </div>
                <ul className="ml-2 space-y-0.5">
                  {blockedVersionsForSelected.map((block, i) => (
                    <li key={i}>• {block.reason}</li>
                  ))}
                </ul>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <div className="space-y-2">
        <div className="text-sm font-semibold">{name}</div>

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
