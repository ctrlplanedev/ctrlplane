import { api } from "~/trpc/react";
import { Loading, Passing, Waiting } from "../StatusIcons";

export const ApprovalCheck: React.FC<{
  workspaceId: string;
  environmentId: string;
  versionId: string;
}> = ({ workspaceId, environmentId, versionId }) => {
  const { data: isApproved, isLoading } =
    api.deployment.version.checks.approval.status.useQuery({
      workspaceId,
      environmentId,
      versionId,
    });

  if (isLoading)
    return (
      <div className="flex items-center gap-2">
        <Loading /> Loading approval status
      </div>
    );

  if (isApproved)
    return (
      <div className="flex items-center gap-2">
        <Passing /> Approved
      </div>
    );

  return (
    <div className="flex items-center gap-2">
      <Waiting /> Not enough approvals
    </div>
  );
};
