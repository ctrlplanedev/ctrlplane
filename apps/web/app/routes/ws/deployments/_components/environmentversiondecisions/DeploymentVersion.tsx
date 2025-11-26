import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { AlertCircleIcon, Check, X } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { PolicySkipDialog } from "./policy-skip/PolicySkipDialog";

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
            <div className="flex-grow" />
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

          {ruleResults.map((rule, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <div>
                {rule.allowed ? (
                  <Check className="size-3 text-green-500" />
                ) : rule.actionRequired ? (
                  <AlertCircleIcon className="size-3 text-red-500" />
                ) : (
                  <X className="size-3 text-green-500" />
                )}
              </div>
              <div key={idx}>{rule.message}</div>
              <div className="flex-grow" />
              <div className="text-xs text-muted-foreground">
                {rule.actionType == "approval" && (
                  <Button
                    className="h-5 bg-green-500/10 px-1.5 text-xs text-green-600 hover:bg-green-500/20 dark:text-green-400"
                    onClick={onClickApprove}
                    disabled={isPending}
                  >
                    Approve
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
