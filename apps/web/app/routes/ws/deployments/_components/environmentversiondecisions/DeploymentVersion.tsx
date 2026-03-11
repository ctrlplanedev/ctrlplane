import _ from "lodash";

import type { DeploymentVersionStatus } from "../types";
import type { ApprovalDetailProps } from "./rule-results/ApprovalDetail";
import { trpc } from "~/api/trpc";
import { Spinner } from "~/components/ui/spinner";
import { ApprovalDetail } from "./rule-results/ApprovalDetail";
import { DeploymentWindowDetail } from "./rule-results/DeploymentWindowDetail";
import { EnvironmentProgressionDetail } from "./rule-results/EnvironmentProgressionDetail";
import { GradRolloutDetail } from "./rule-results/GradRolloutDetail";
import { VersionStatusDetail } from "./rule-results/VersionStatusDetail";

type DeploymentVersionProps = {
  version: { id: string; status: DeploymentVersionStatus };
  environment: { id: string };
};

export function DeploymentVersion(props: DeploymentVersionProps) {
  const { version, environment } = props;

  const { data, isLoading } = trpc.deploymentVersions.evaulate.useQuery(
    { versionId: version.id, environmentId: environment.id },
    { refetchInterval: 5000 },
  );

  const rules = _.groupBy(data, (d) => d.ruleType);

  if (isLoading)
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner className="size-3 animate-spin" />
        Loading...
      </div>
    );

  if (data == null) return null;

  const approvalDetail =
    "approval" in rules &&
    (rules.approval[0]?.details as ApprovalDetailProps | undefined);

  return (
    <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
      {approvalDetail && <ApprovalDetail {...approvalDetail} />}
      {"deploymentWindow" in rules && (
        <DeploymentWindowDetail windows={rules.deploymentWindow} />
      )}
      {"gradualRollout" in rules && (
        <GradRolloutDetail rules={rules.gradualRollout} />
      )}
      {"environmentProgression" in rules && (
        <EnvironmentProgressionDetail rules={rules.environmentProgression} />
      )}
      <VersionStatusDetail version={version} />
    </div>
  );
}
