"use client";

import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import { IconEdit, IconTrash } from "@tabler/icons-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { DeleteSystemDialog } from "./[systemSlug]/_components/DeleteSystemDialog";
import { EditSystemDialog } from "./[systemSlug]/_components/EditSystemDialog";

type SystemActionsDropdownProps = {
  system: schema.System;
  children: React.ReactNode;
};

export const SystemActionsDropdown: React.FC<SystemActionsDropdownProps> = ({
  system,
  children,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>{children}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <EditSystemDialog system={system}>
            <DropdownMenuItem
              className="flex items-center gap-2"
              onSelect={(e) => e.preventDefault()}
            >
              <IconEdit className="h-4 w-4 text-muted-foreground" />
              Edit
            </DropdownMenuItem>
          </EditSystemDialog>
          <DeleteSystemDialog system={system}>
            <DropdownMenuItem
              className="flex items-center gap-2 text-red-400 hover:text-red-200"
              onSelect={(e) => e.preventDefault()}
            >
              <IconTrash className="h-4 w-4 text-red-400" />
              Delete
            </DropdownMenuItem>
          </DeleteSystemDialog>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
