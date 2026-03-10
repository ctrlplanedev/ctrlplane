import _ from "lodash";

import type { DeploymentVersionStatus } from "../types";
import type { ApprovalDetailProps } from "./rule-results/ApprovalDetail";
import { trpc } from "~/api/trpc";
import { Spinner } from "~/components/ui/spinner";
import { ApprovalDetail } from "./rule-results/ApprovalDetail";
import { DeploymentWindowDetail } from "./rule-results/DeploymentWindowDetail";
import { GradRolloutDetail } from "./rule-results/GradRolloutDetail";

type DeploymentVersionProps = {
  version: { id: string; status: DeploymentVersionStatus };
  environment: { id: string };
};

export function DeploymentVersion(props: DeploymentVersionProps) {
  const { version, environment } = props;

  const { data, isLoading } = trpc.deploymentVersions.evaulate.useQuery(
    {
      versionId: version.id,
      environmentId: environment.id,
    },
    {
      refetchInterval: 5000,
    },
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

  const approvalDetail = rules.approval[0]?.details as
    | ApprovalDetailProps
    | undefined;
  console.log(Object.keys(rules));
  return (
    <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
      {approvalDetail && <ApprovalDetail {...approvalDetail} />}
      {"deploymentWindow" in rules && (
        <DeploymentWindowDetail windows={rules.deploymentWindow} />
      )}
      {"gradualRollout" in rules && (
        <GradRolloutDetail rules={rules.gradualRollout} />
      )}
      {/* {data.policyResults.map(({ policy, ruleResults }, idx) => (
        <div key={idx} className="w-full space-y-1 rounded-lg border p-2">
          <div className="mb-2 flex items-center font-semibold">
            {policy == null ? "Global Policies" : policy.name}
            <div className="grow" />
            <PolicySkipDialog
              environmentId={environment.id}
              versionId={version.id}
              rules={policy?.rules ?? GLOBAL_EVALUATORS}
            >
              <Button size="sm" variant="outline" className="h-4 px-1 text-xs">
                Configure skips
              </Button>
            </PolicySkipDialog>
          </div>

          {ruleResults.map((ruleResult) => (
            <RuleResult
              key={ruleResult.ruleId}
              ruleResult={ruleResult}
              onClickApprove={onClickApprove}
              isPending={isPending}
            />
          ))}
        </div>
      ))} */}
    </div>
  );
}
