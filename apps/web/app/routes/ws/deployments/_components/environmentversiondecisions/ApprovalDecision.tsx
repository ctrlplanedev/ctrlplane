import { CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

import type { DeploymentVersion, Environment } from "./types";
import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { usePolicyResults } from "./usePolicyResults";

const useApproveDeploymentVersion = (
  versionId: string,
  environmentId: string,
) => {
  const { workspace } = useWorkspace();
  const approveMutation = trpc.deploymentVersions.approve.useMutation();
  const onClick = () =>
    approveMutation
      .mutateAsync({
        workspaceId: workspace.id,
        deploymentVersionId: versionId,
        environmentId: environmentId,
        status: "approved",
      })
      .then(() => toast.success("Approval record queued successfully"));
  return { onClick, isPending: approveMutation.isPending };
};

export function ApprovalDecision({
  version,
  environment,
}: {
  version: DeploymentVersion;
  environment: Environment;
}) {
  const { onClick: onClickApprove, isPending: isPendingApprove } =
    useApproveDeploymentVersion(version.id, environment.id);
  const { policyResults } = usePolicyResults(environment.id, version.id);
  const approvalResult = policyResults?.approval;
  if (approvalResult == null) return null;

  return (
    <div className="flex items-center gap-1.5">
      {approvalResult.allowed && (
        <>
          <CheckCircle className="size-3 text-green-500" />
          <span className="text-xs font-semibold text-muted-foreground">
            Approved
          </span>
        </>
      )}
      {!approvalResult.allowed && (
        <>
          <XCircle className="size-3 text-red-500" />
          <span className="text-xs font-semibold text-muted-foreground">
            Not approved ({approvalResult.approvers.length}/
            {approvalResult.minApprovals})
          </span>
        </>
      )}
      <div className="flex-grow" />
      <Button
        variant="outline"
        size="sm"
        className="h-5 text-xs"
        onClick={onClickApprove}
        disabled={isPendingApprove}
      >
        Approve
      </Button>
    </div>
  );
}
