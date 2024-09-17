"use client";

import type { Runbook, RunbookVariable } from "@ctrlplane/db/schema";
import { TbDotsVertical } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { TriggerRunbookDialog } from "./TriggerRunbook";

export const RunbookRow: React.FC<{
  runbook: Runbook & { variables: RunbookVariable[] };
}> = ({ runbook }) => {
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
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Trigger Runbook
            </DropdownMenuItem>
          </TriggerRunbookDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
