import type * as schema from "@ctrlplane/db/schema";
import { TbDotsVertical } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { api } from "~/trpc/server";
import { EditAgentConfigDialog } from "../_components/EditAgentConfigDialog";
import { RunbookDropdownMenuItem } from "./RunbookDropdownMenuItem";
import { TriggerRunbookDialog } from "./TriggerRunbook";

export const RunbookRow: React.FC<{
  runbook: schema.Runbook & {
    variables: schema.RunbookVariable[];
    jobAgent: schema.JobAgent | null;
  };
  workspace: schema.Workspace;
  jobAgents: schema.JobAgent[];
}> = ({ runbook, workspace, jobAgents }) => {
  return (
    <div className="flex items-center justify-between border-b p-4">
      <div>
        <h3 className="font-semibold">{runbook.name}</h3>
        <p className="text-sm text-muted-foreground">{runbook.description}</p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <TbDotsVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <TriggerRunbookDialog runbook={runbook}>
            <RunbookDropdownMenuItem>Trigger Runbook</RunbookDropdownMenuItem>
          </TriggerRunbookDialog>
          {runbook.jobAgent != null && (
            <EditAgentConfigDialog
              jobAgent={runbook.jobAgent}
              workspace={workspace}
              jobAgents={jobAgents}
              value={runbook.jobAgentConfig}
              onSubmit={async (data) => {
                "use server";
                await api.runbook.update({
                  id: runbook.id,
                  data: {
                    jobAgentId: data.jobAgentId,
                    jobAgentConfig: data.config,
                  },
                });
              }}
            >
              <RunbookDropdownMenuItem>Edit Job Agent</RunbookDropdownMenuItem>
            </EditAgentConfigDialog>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
