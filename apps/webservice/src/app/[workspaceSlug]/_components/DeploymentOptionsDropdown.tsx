"use client";

import React, { useState } from "react";
import { TbDotsVertical, TbEdit, TbTrash } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { DeleteDeploymentDialog } from "./DeleteDeployment";
import { EditDeploymentDialog } from "./EditDeploymentDialog";

export const DeploymentOptionsDropdown: React.FC<{
  id: string;
  name: string;
  slug: string;
  description: string;
  systemId: string;
}> = (props) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="rounded-full">
            <TbDotsVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-42 bg-neutral-900"
          align="center"
          forceMount
        >
          <DropdownMenuGroup>
            <EditDeploymentDialog {...props}>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <TbEdit className="mr-2" />
                Edit
              </DropdownMenuItem>
            </EditDeploymentDialog>
            <DropdownMenuItem onSelect={() => setDeleteDialogOpen(true)}>
              <TbTrash className="mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteDeploymentDialog
        {...props}
        isOpen={deleteDialogOpen}
        setIsOpen={setDeleteDialogOpen}
      />
    </>
  );
};
