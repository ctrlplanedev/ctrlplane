import { Button } from "@ctrlplane/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { ApprovalDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/ApprovalDialog";
import { api } from "~/trpc/react";
import { Loading, Passing, Waiting } from "../StatusIcons";

export const ApprovalCheck: React.FC<{
  workspaceId: string;
  environmentId: string;
  versionId: string;
  versionTag: string;
}> = (props) => {
  const { data, isLoading } =
    api.deployment.version.checks.approval.status.useQuery(props);
  const utils = api.useUtils();
  const invalidate = () =>
    utils.deployment.version.checks.approval.status.invalidate(props);

  const isApproved = data?.approved ?? false;
  const rejectionReasonEntries = Array.from(
    data?.rejectionReasons.entries() ?? [],
  );

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

  if (rejectionReasonEntries.length > 0)
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
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
          </TooltipTrigger>
          <TooltipContent>
            <ul>
              {rejectionReasonEntries.map(([reason, comment]) => (
                <li key={reason}>
                  {reason}: {comment}
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
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
