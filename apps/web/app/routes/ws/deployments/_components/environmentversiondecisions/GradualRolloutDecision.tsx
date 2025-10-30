import { CheckCircle, Clock, Loader2 } from "lucide-react";

import type { DeploymentVersion, Environment } from "./types";
import { usePolicyResults } from "./usePolicyResults";

export function GradualRolloutDecision({
  version,
  environment,
}: {
  version: DeploymentVersion;
  environment: Environment;
}) {
  const { policyResults } = usePolicyResults(environment.id, version.id);
  const gradualRolloutResult = policyResults?.gradualRollout;
  if (gradualRolloutResult == null) return null;

  const { rolloutStartTime, rolloutInfos } = gradualRolloutResult;

  if (rolloutStartTime == null)
    return (
      <div className="flex items-center gap-1.5">
        <Clock className="size-3 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground">
          Not started, pending approvals
        </span>
      </div>
    );

  const isRolloutComplete = rolloutInfos.every(({ allowed }) => allowed);
  if (isRolloutComplete)
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle className="size-3 text-green-500" />
        <span className="text-xs font-semibold text-green-500">
          Rollout complete
        </span>
      </div>
    );

  const numAllowed = rolloutInfos.filter(({ allowed }) => allowed).length;

  return (
    <div className="flex items-center gap-1.5">
      <Loader2 className="size-3 animate-spin text-blue-500" />
      <span className="text-xs font-semibold text-muted-foreground">
        Rollout in progress ({numAllowed}/{rolloutInfos.length})
      </span>
    </div>
  );
}
