"use client";

import type * as schema from "@ctrlplane/db/schema";
import { useState } from "react";
import { IconDotsVertical } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { api } from "~/trpc/react";
import { EditAgentConfigDialog } from "../_components/EditAgentConfigDialog";
import { TriggerRunbookDialog } from "./TriggerRunbook";

export const RunbookRow: React.FC<{
  runbook: schema.Runbook & {
    variables: schema.RunbookVariable[];
    jobAgent: schema.JobAgent | null;
  };
  workspace: schema.Workspace;
  jobAgents: schema.JobAgent[];
}> = ({ runbook, workspace, jobAgents }) => {
  const updateRunbook = api.runbook.update.useMutation();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between border-b p-4">
      <div>
        <h3 className="font-semibold">{runbook.name}</h3>
        <p className="text-sm text-muted-foreground">{runbook.description}</p>
      </div>

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <IconDotsVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <TriggerRunbookDialog
            runbook={runbook}
            onSuccess={() => setOpen(false)}
          >
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Trigger Runbook
            </DropdownMenuItem>
          </TriggerRunbookDialog>
          {runbook.jobAgent != null && (
            <EditAgentConfigDialog
              jobAgent={runbook.jobAgent}
              workspace={workspace}
              jobAgents={jobAgents}
              value={runbook.jobAgentConfig}
              onSubmit={(data) =>
                updateRunbook
                  .mutateAsync({
                    id: runbook.id,
                    data: {
                      jobAgentId: data.jobAgentId,
                      jobAgentConfig: data.config,
                    },
                  })
                  .then(() => setOpen(false))
              }
            >
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                Edit Job Agent
              </DropdownMenuItem>
            </EditAgentConfigDialog>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
