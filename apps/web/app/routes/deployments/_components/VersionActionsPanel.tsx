import { CheckCircle, Info, X } from "lucide-react";

import type { DeploymentVersion, Environment, ReleaseTarget } from "./types";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

type VersionActionsPanelProps = {
  version: DeploymentVersion;
  environments: Environment[];
  releaseTargets: ReleaseTarget[];
  onClose: () => void;
};

export const VersionActionsPanel: React.FC<VersionActionsPanelProps> = ({
  version,
  environments,
  releaseTargets,
  onClose,
}) => {
  // Calculate deployment status per environment
  const envStatus = environments.map((env) => {
    const rts = releaseTargets.filter((rt) => rt.environment.id === env.id);
    const currentCount = rts.filter(
      (rt) => rt.version.currentId === version.id,
    ).length;
    const desiredCount = rts.filter(
      (rt) => rt.version.desiredId === version.id,
    ).length;

    // Get blocked release targets with their reasons
    const blockedReleaseTargets = rts.filter((rt) =>
      rt.version.blockedVersions?.some((bv) => bv.versionId === version.id),
    );
    const blockedCount = blockedReleaseTargets.length;

    // Collect all unique block reasons for this environment
    const blockReasons = new Map<string, Set<string>>();
    blockedReleaseTargets.forEach((rt) => {
      const blocked = rt.version.blockedVersions?.find(
        (bv) => bv.versionId === version.id,
      );
      if (blocked) {
        if (!blockReasons.has(blocked.reason)) {
          blockReasons.set(blocked.reason, new Set());
        }
        blockReasons.get(blocked.reason)?.add(rt.resource.name);
      }
    });

    const total = rts.length;

    return {
      env,
      currentCount,
      desiredCount,
      blockedCount,
      total,
      blockReasons: Array.from(blockReasons.entries()).map(
        ([reason, resources]) => ({
          reason,
          resources: Array.from(resources),
        }),
      ),
    };
  });

  const totalCurrent = envStatus.reduce((sum, e) => sum + e.currentCount, 0);
  const totalDesired = envStatus.reduce((sum, e) => sum + e.desiredCount, 0);
  const totalBlocked = envStatus.reduce((sum, e) => sum + e.blockedCount, 0);

  return (
    <div className="flex h-full flex-col overflow-y-auto border-l bg-background">
      <div className="flex items-center justify-between border-b p-4">
        <div className="space-y-1">
          <div className="font-mono text-lg font-semibold">{version.tag}</div>
          <div className="text-xs text-muted-foreground">
            Where is this version deployed?
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1">
        <div className="space-y-6 p-4">
          {/* Overall Summary */}
          <div className="space-y-2">
            <div className="text-sm font-semibold">Overall Status</div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-muted-foreground">
                  Currently running on
                </span>
                <span className="font-semibold">{totalCurrent} resources</span>
              </div>
              {totalDesired > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                  <span className="text-blue-600">Should be running on</span>
                  <span className="font-semibold text-blue-600">
                    {totalDesired} resources
                  </span>
                </div>
              )}
              {totalBlocked > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <span className="text-amber-600">Blocked by policies</span>
                  <span className="font-semibold text-amber-600">
                    {totalBlocked} resources
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Per-environment breakdown */}
          <div className="space-y-3">
            <div className="text-sm font-semibold">By Environment</div>
            {envStatus
              .filter(
                (e) =>
                  e.currentCount > 0 ||
                  e.desiredCount > 0 ||
                  e.blockedCount > 0,
              ) // Only show relevant envs
              .map(
                ({
                  env,
                  currentCount,
                  desiredCount,
                  blockedCount,
                  total,
                  blockReasons,
                }) => {
                  const isFullyDeployed =
                    currentCount === total &&
                    desiredCount === 0 &&
                    blockedCount === 0;
                  const canDeploy =
                    desiredCount > currentCount && blockedCount === 0;
                  const hasBlocks = blockedCount > 0;

                  return (
                    <div
                      key={env.id}
                      className="space-y-3 rounded-lg border p-3"
                    >
                      {/* Environment name and status */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-medium">{env.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {total} total resources
                          </div>
                        </div>
                        {isFullyDeployed && (
                          <Badge className="border-green-500/20 bg-green-500/10 text-green-600">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Complete
                          </Badge>
                        )}
                      </div>

                      {/* Deployment breakdown */}
                      <div className="space-y-2">
                        {currentCount > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              ✓ Currently running
                            </span>
                            <span className="font-medium">
                              {currentCount} resources
                            </span>
                          </div>
                        )}

                        {desiredCount > 0 && desiredCount !== currentCount && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-blue-600">
                              → Should be running on
                            </span>
                            <span className="font-medium text-blue-600">
                              {desiredCount} resources
                            </span>
                          </div>
                        )}

                        {hasBlocks && (
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-1">
                              <span className="text-amber-600">
                                🛡️ Blocked by policies
                              </span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-3.5 w-3.5 cursor-help text-amber-600" />
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="left"
                                    className="max-w-sm"
                                  >
                                    <div className="space-y-2 text-xs">
                                      <div className="font-semibold">
                                        Policy Blocks:
                                      </div>
                                      {blockReasons.map((br, i) => (
                                        <div key={i} className="space-y-1">
                                          <div className="font-medium text-amber-600">
                                            {br.reason}
                                          </div>
                                          <div className="text-muted-foreground">
                                            Affects: {br.resources.join(", ")}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <span className="font-medium text-amber-600">
                              {blockedCount} resources
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action */}
                      {canDeploy && (
                        <div className="border-t pt-2">
                          <Button size="sm" className="w-full">
                            Deploy to {desiredCount - currentCount} more{" "}
                            {desiredCount - currentCount === 1
                              ? "resource"
                              : "resources"}
                          </Button>
                        </div>
                      )}

                      {hasBlocks && (
                        <div className="border-t pt-2 text-xs text-muted-foreground">
                          Cannot deploy due to policy restrictions
                        </div>
                      )}
                    </div>
                  );
                },
              )}

            {/* No deployments message */}
            {envStatus.every(
              (e) =>
                e.currentCount === 0 &&
                e.desiredCount === 0 &&
                e.blockedCount === 0,
            ) && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                This version is not deployed to any environment
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
