import { Button } from "@ctrlplane/ui/button";

import { ApprovalDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/ApprovalDialog";
import { api } from "~/trpc/react";
import { Loading, Passing, Waiting } from "../StatusIcons";

export const ApprovalCheck: React.FC<{
  workspaceId: string;
  environmentId: string;
  versionId: string;
  versionTag: string;
}> = (props) => {
  const { data, isLoading } = api.policy.evaluate.useQuery(props);
  const utils = api.useUtils();
  const invalidate = () => utils.policy.evaluate.invalidate(props);

  const isAnyApprovalSatisfied = Object.values(
    data?.rules.anyApprovals ?? {},
  ).every((reasons) => reasons.length === 0);
  const isUserApprovalSatisfied = Object.values(
    data?.rules.userApprovals ?? {},
  ).every((reasons) => reasons.length === 0);
  const isRoleApprovalSatisfied = Object.values(
    data?.rules.roleApprovals ?? {},
  ).every((reasons) => reasons.length === 0);

  const isApproved =
    isAnyApprovalSatisfied &&
    isUserApprovalSatisfied &&
    isRoleApprovalSatisfied;

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
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Waiting /> Not enough approvals
      </div>
      <ApprovalDialog {...props} onSubmit={invalidate}>
        <Button size="sm" className="h-6">
          Approve
        </Button>
      </ApprovalDialog>
    </div>
  );
};
