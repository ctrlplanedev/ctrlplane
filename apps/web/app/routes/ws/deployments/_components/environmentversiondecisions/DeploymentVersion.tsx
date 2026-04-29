import { useMemo } from "react";
import _ from "lodash";

import type { DeploymentVersionStatus } from "../types";
import type { ApprovalDetailProps } from "./rule-results/ApprovalDetail";
import { trpc } from "~/api/trpc";
import { Spinner } from "~/components/ui/spinner";
import { ApprovalDetail } from "./rule-results/ApprovalDetail";
import { DependencyDetail } from "./rule-results/DependencyDetail";
import { DeploymentWindowDetail } from "./rule-results/DeploymentWindowDetail";
import { EnvironmentProgressionDetail } from "./rule-results/EnvironmentProgressionDetail";
import { GradRolloutDetail } from "./rule-results/GradRolloutDetail";
import { VersionCooldownDetail } from "./rule-results/VersionCooldownDetail";
import { VersionStatusDetail } from "./rule-results/VersionStatusDetail";

type DeploymentVersionProps = {
  version: { id: string; status: DeploymentVersionStatus };
  environment: { id: string; name: string };
};

export function DeploymentVersion(props: DeploymentVersionProps) {
  const { version, environment } = props;

  const { data, isLoading } = trpc.deploymentVersions.evaulate.useQuery(
    { versionId: version.id, environmentId: environment.id },
    { refetchInterval: 5000 },
  );

  const { data: skips } = trpc.policySkips.forEnvAndVersion.useQuery(
    { environmentId: environment.id, versionId: version.id },
    { staleTime: 30_000 },
  );

  const skippedRuleIds = useMemo(
    () => new Set((skips ?? []).map((s) => s.ruleId)),
    [skips],
  );

  const rules = _.groupBy(data, (d) => d.ruleType);

  if (isLoading)
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner className="size-3 animate-spin" />
        Loading...
      </div>
    );

  const approvalEval =
    data != null && "approval" in rules ? rules.approval[0] : undefined;
  const approvalDetail = approvalEval?.details as
    | ApprovalDetailProps
    | undefined;
  const approvalSkipped =
    approvalEval != null && skippedRuleIds.has(approvalEval.ruleId);

  return (
    <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
      {approvalDetail && (
        <ApprovalDetail {...approvalDetail} isSkipped={approvalSkipped} />
      )}
      {"deploymentWindow" in rules && (
        <DeploymentWindowDetail
          windows={rules.deploymentWindow}
          skippedRuleIds={skippedRuleIds}
        />
      )}
      {"gradualRollout" in rules && (
        <GradRolloutDetail
          rules={rules.gradualRollout}
          skippedRuleIds={skippedRuleIds}
        />
      )}
      {"versionCooldown" in rules && (
        <VersionCooldownDetail
          cooldowns={rules.versionCooldown}
          skippedRuleIds={skippedRuleIds}
        />
      )}
      {"environmentProgression" in rules && (
        <EnvironmentProgressionDetail
          rules={rules.environmentProgression}
          skippedRuleIds={skippedRuleIds}
        />
      )}
      <DependencyDetail versionId={version.id} environment={environment} />
      <VersionStatusDetail version={version} />
    </div>
  );
}
