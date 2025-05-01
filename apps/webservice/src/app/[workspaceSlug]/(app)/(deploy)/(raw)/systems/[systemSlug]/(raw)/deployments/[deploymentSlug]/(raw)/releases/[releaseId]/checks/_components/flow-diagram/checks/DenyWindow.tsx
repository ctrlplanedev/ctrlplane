import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { api } from "~/trpc/react";
import { Loading, Passing, Waiting } from "../StatusIcons";

export const DenyWindowCheck: React.FC<{
  workspaceId: string;
  environmentId: string;
  versionId: string;
}> = ({ workspaceId, environmentId, versionId }) => {
  const { data, isLoading } =
    api.deployment.version.checks.denyWindow.status.useQuery({
      workspaceId,
      environmentId,
      versionId,
    });

  const isBlocked = data ?? false;
  const rejectionReasonEntries: Array<[string, string]> = [];

  if (isLoading)
    return (
      <div className="flex items-center gap-2">
        <Loading /> Loading deny windows
      </div>
    );

  if (!isBlocked)
    return (
      <div className="flex items-center gap-2">
        <Passing /> no active deny windows
      </div>
    );

  if (rejectionReasonEntries.length > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center gap-2">
              <Waiting /> deny window is active
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
      <Waiting /> currently in deny window
    </div>
  );
};
