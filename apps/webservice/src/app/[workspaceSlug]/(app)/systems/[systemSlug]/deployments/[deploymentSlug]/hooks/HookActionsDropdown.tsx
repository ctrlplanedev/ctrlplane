"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";
import React, { useState } from "react";
import { IconEdit, IconTrash } from "@tabler/icons-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { DeleteHookDialog } from "./DeleteHookDialog";
import { EditHookDialog } from "./EditHookDialog";

type Hook = RouterOutputs["deployment"]["hook"]["list"][number];
type HookActionsDropdownProps = {
  hook: Hook;
  runbooks: SCHEMA.Runbook[];
  children: React.ReactNode;
};

export const HookActionsDropdown: React.FC<HookActionsDropdownProps> = ({
  hook,
  runbooks,
  children,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <EditHookDialog
          hook={hook}
          runbooks={runbooks}
          onClose={() => setOpen(false)}
        >
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex cursor-pointer items-center gap-2"
          >
            <IconEdit className="h-4 w-4" />
            Edit
          </DropdownMenuItem>
        </EditHookDialog>
        <DeleteHookDialog hookId={hook.id} onClose={() => setOpen(false)}>
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex cursor-pointer items-center gap-2"
          >
            <IconTrash className="h-4 w-4 text-red-500" />
            Delete
          </DropdownMenuItem>
        </DeleteHookDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
