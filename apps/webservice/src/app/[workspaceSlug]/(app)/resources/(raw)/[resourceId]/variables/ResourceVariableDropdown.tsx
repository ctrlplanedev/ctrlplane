"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React, { useState } from "react";
import { IconPencil, IconTrash } from "@tabler/icons-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { DeleteResourceVariableDialog } from "./DeleteResourceVariableDialog";
import { EditResourceVariableDialog } from "./EditResourceVariableDialog";

type ResourceVariableDropdownProps = {
  resourceVariable: SCHEMA.ResourceVariable;
  existingKeys: string[];
  children: React.ReactNode;
};

export const ResourceVariableDropdown: React.FC<
  ResourceVariableDropdownProps
> = ({ resourceVariable, existingKeys, children }) => {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {resourceVariable.valueType === "direct" && (
          <EditResourceVariableDialog
            resourceVariable={resourceVariable}
            existingKeys={existingKeys}
            onClose={() => setOpen(false)}
          >
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2"
              onSelect={(e) => e.preventDefault()}
            >
              <IconPencil className="h-4 w-4" />
              Edit
            </DropdownMenuItem>
          </EditResourceVariableDialog>
        )}
        <DeleteResourceVariableDialog
          variableId={resourceVariable.id}
          resourceId={resourceVariable.resourceId}
          onClose={() => setOpen(false)}
        >
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onSelect={(e) => e.preventDefault()}
          >
            <IconTrash className="h-4 w-4 text-red-500" />
            Delete
          </DropdownMenuItem>
        </DeleteResourceVariableDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
