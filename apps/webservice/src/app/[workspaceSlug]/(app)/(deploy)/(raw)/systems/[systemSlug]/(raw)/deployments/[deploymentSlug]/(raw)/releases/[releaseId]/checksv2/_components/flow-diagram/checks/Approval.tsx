import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { api } from "~/trpc/react";
import { Loading, Passing, Waiting } from "../StatusIcons";

export const ApprovalCheck: React.FC<{
  workspaceId: string;
  environmentId: string;
  versionId: string;
}> = ({ workspaceId, environmentId, versionId }) => {
  const { data, isLoading } =
    api.deployment.version.checks.approval.status.useQuery({
      workspaceId,
      environmentId,
      versionId,
    });

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

  if (rejectionReasonEntries.length > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center gap-2">
              <Waiting /> Not enough approvals
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
  }

  return (
    <div className="flex items-center gap-2">
      <Waiting /> Not enough approvals
    </div>
  );
};
