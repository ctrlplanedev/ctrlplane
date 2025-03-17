import { Button } from "@ctrlplane/ui/button";

import { ApprovalDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/ApprovalDialog";
import { api } from "~/trpc/react";
import { Cancelled, Failing, Loading, Passing, Waiting } from "./StatusIcons";

export const ApprovalCheck: React.FC<{
  policyId: string;
  deploymentVersion: { id: string; tag: string; deploymentId: string };
}> = ({ policyId, deploymentVersion }) => {
  const approvalStatus =
    api.environment.policy.approval.statusByVersionPolicyId.useQuery({
      policyId,
      versionId: deploymentVersion.id,
    });

  if (approvalStatus.isLoading)
    return (
      <div className="flex items-center gap-2">
        <Loading /> Loading approval status
      </div>
    );

  if (approvalStatus.data == null)
    return (
      <div className="flex items-center gap-2">
        <Cancelled /> Approval skipped
      </div>
    );

  const status = approvalStatus.data.status;
  return (
    <div className="flex w-full items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {status === "approved" && (
          <>
            <Passing /> Approved
          </>
        )}
        {status === "rejected" && (
          <>
            <Failing /> Rejected
          </>
        )}
        {status === "pending" && (
          <>
            <Waiting /> Pending approval
          </>
        )}
      </div>

      {status === "pending" && (
        <ApprovalDialog
          policyId={policyId}
          deploymentVersion={deploymentVersion}
        >
          <Button size="sm" className="h-6 px-2 py-1">
            Review
          </Button>
        </ApprovalDialog>
      )}
    </div>
  );
};
