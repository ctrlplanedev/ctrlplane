"use client";

import React, { useState } from "react";
import {
  IconEdit,
  IconRefresh,
  IconRocket,
  IconTrash,
} from "@tabler/icons-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { CreateDeploymentVersionDialog } from "../../deployment-version/CreateDeploymentVersion";
import { DeleteDeploymentDialog } from "./DeleteDeployment";
import { EditDeploymentDialog } from "./EditDeploymentDialog";
import { RedeployJobsDialog } from "./RedeployJobsDialog";

export const DeploymentOptionsDropdown: React.FC<{
  id: string;
  name: string;
  slug: string;
  description: string;
  systemId: string;
  children: React.ReactNode;
}> = (props) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>{props.children}</DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-42 bg-neutral-900"
          align="center"
          forceMount
        >
          <DropdownMenuGroup>
            <CreateDeploymentVersionDialog
              deploymentId={props.id}
              systemId={props.systemId}
            >
              <DropdownMenuItem
                className="flex items-center gap-2"
                onSelect={(e) => e.preventDefault()}
              >
                <IconRocket className="h-4 w-4" />
                New Version
              </DropdownMenuItem>
            </CreateDeploymentVersionDialog>
            <EditDeploymentDialog {...props}>
              <DropdownMenuItem
                className="flex items-center gap-2"
                onSelect={(e) => e.preventDefault()}
              >
                <IconEdit className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
            </EditDeploymentDialog>
            <RedeployJobsDialog
              deploymentId={props.id}
              onClose={() => setOpen(false)}
            >
              <DropdownMenuItem
                className="flex items-center gap-2"
                onSelect={(e) => e.preventDefault()}
              >
                <IconRefresh className="h-4 w-4" />
                Redeploy Jobs
              </DropdownMenuItem>
            </RedeployJobsDialog>
            <DropdownMenuItem
              className="flex items-center gap-2 text-red-400 hover:text-red-200"
              onSelect={() => setDeleteDialogOpen(true)}
            >
              <IconTrash className="h-4 w-4 text-red-400" />
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
