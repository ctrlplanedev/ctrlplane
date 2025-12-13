import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { PolicySkipDialog } from "./policy-skip/PolicySkipDialog";
import { RuleResult } from "./RuleResult";

const GLOBAL_EVALUATORS: WorkspaceEngine["schemas"]["PolicyRule"][] = [
  {
    id: "pausedVersions",
    policyId: "",
    createdAt: new Date().toISOString(),
  },
  {
    id: "deployableVersions",
    policyId: "",
    createdAt: new Date().toISOString(),
  },
];

function usePolicyEvaluations(versionId: string, environmentId: string) {
  const { workspace } = useWorkspace();
  const { data, isLoading } = trpc.policies.evaluate.useQuery(
    {
      workspaceId: workspace.id,
      scope: { environmentId, versionId },
    },
    { refetchInterval: 30_000 },
  );

  return { data, isLoading };
}

function useApproveVersion(versionId: string, environmentId: string) {
  const utils = trpc.useUtils();
  const { workspace } = useWorkspace();
  const approveMutation = trpc.deploymentVersions.approve.useMutation();
  const onClickApprove = () =>
    approveMutation
      .mutateAsync({
        workspaceId: workspace.id,
        deploymentVersionId: versionId,
        environmentId: environmentId,
        status: "approved",
      })
      .then(() => {
        toast.success("Approval record queued successfully");
        utils.policies.evaluate.invalidate({
          workspaceId: workspace.id,
          scope: { environmentId, versionId },
        });
      });

  return { onClickApprove, isPending: approveMutation.isPending };
}

export function DeploymentVersion({
  version,
  environment,
}: {
  version: WorkspaceEngine["schemas"]["DeploymentVersion"];
  environment: WorkspaceEngine["schemas"]["Environment"];
}) {
  const { data, isLoading } = usePolicyEvaluations(version.id, environment.id);
  const { onClickApprove, isPending } = useApproveVersion(
    version.id,
    environment.id,
  );

  if (isLoading)
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner className="size-3 animate-spin" />
        Loading...
      </div>
    );

  if (data == null) return null;

  return (
    <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
      {data.policyResults.map(({ policy, ruleResults }, idx) => (
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
      ))}
    </div>
  );
}
