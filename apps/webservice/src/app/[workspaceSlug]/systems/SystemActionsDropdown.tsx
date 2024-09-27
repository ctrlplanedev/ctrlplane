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
              onSelect={(e) => e.preventDefault()}
              onClick={(e) => e.stopPropagation()}
            >
              <IconEdit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          </EditSystemDialog>
          <DeleteSystemDialog system={system}>
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              onClick={(e) => e.stopPropagation()}
            >
              <IconTrash className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DeleteSystemDialog>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
