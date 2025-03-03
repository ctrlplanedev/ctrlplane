"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as schema from "@ctrlplane/db/schema";
import { useState } from "react";
import {
  IconBolt,
  IconDotsVertical,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { DeleteRunbookDialog } from "./DeleteRunbookDialog";
import { EditRunbookDialog } from "./EditRunbookDialog";
import { TriggerRunbookDialog } from "./TriggerRunbook";

export const RunbookRow: React.FC<{
  runbook: RouterOutputs["runbook"]["bySystemId"][number];
  workspace: schema.Workspace;
  jobAgents: schema.JobAgent[];
}> = ({ runbook, workspace, jobAgents }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between border-b p-4">
      <div>
        <h3 className="font-semibold">{runbook.name}</h3>
        <p className="text-sm text-muted-foreground">{runbook.description}</p>
      </div>

      <div className="flex items-center gap-2">
        {runbook.runhooks.length > 0 && (
          <Badge variant="secondary">Managed by hook</Badge>
        )}
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
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="flex cursor-pointer items-center gap-2"
            >
              <IconBolt className="h-4 w-4" />
              Trigger Runbook
            </DropdownMenuItem>
          </TriggerRunbookDialog>
          <EditRunbookDialog
            runbook={runbook}
            workspace={workspace}
            jobAgents={jobAgents}
          >
            {runbook.runhooks.length > 0 ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="flex cursor-pointer items-center gap-2"
                      disabled
                    >
                      <IconEdit className="h-4 w-4" />
                      Edit Runbook
                    </DropdownMenuItem>
                  </TooltipTrigger>
                  <TooltipContent>
                    Runbooks managed by hooks cannot be edited.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="flex cursor-pointer items-center gap-2"
              >
                <IconEdit className="h-4 w-4" />
                Edit Runbook
              </DropdownMenuItem>
            )}
          </EditRunbookDialog>
          <DeleteRunbookDialog runbook={runbook} onClose={() => setOpen(false)}>
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="flex cursor-pointer items-center gap-2"
            >
              <IconTrash className="h-4 w-4 text-red-500" />
              Delete Runbook
            </DropdownMenuItem>
          </DeleteRunbookDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
