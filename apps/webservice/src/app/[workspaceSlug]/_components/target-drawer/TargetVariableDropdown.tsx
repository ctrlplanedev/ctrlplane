import type * as SCHEMA from "@ctrlplane/db/schema";
import React, { useState } from "react";
import { IconPencil, IconTrash } from "@tabler/icons-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { DeleteTargetVariableDialog } from "./DeleteTargetVariableDialog";
import { EditTargetVariableDialog } from "./EditTargetVariableDialog";

type TargetVariableDropdownProps = {
  targetVariable: SCHEMA.ResourceVariable;
  existingKeys: string[];
  children: React.ReactNode;
};

export const TargetVariableDropdown: React.FC<TargetVariableDropdownProps> = ({
  targetVariable,
  existingKeys,
  children,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <EditTargetVariableDialog
          targetVariable={targetVariable}
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
        </EditTargetVariableDialog>
        <DeleteTargetVariableDialog
          variableId={targetVariable.id}
          targetId={targetVariable.resourceId}
          onClose={() => setOpen(false)}
        >
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onSelect={(e) => e.preventDefault()}
          >
            <IconTrash className="h-4 w-4 text-red-500" />
            Delete
          </DropdownMenuItem>
        </DeleteTargetVariableDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
