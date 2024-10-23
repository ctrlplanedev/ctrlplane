import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ctrlplane/ui/alert-dialog";
import { buttonVariants } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import type { VariableData } from "./variable-data";
import { api } from "~/trpc/react";
import { AddVariableValueDialog } from "./AddVariableValueDialog";
import { EditVariableDialog } from "./EditVariableDialog";

const DeleteVariableDialog: React.FC<{
  variableId: string;
  children: React.ReactNode;
}> = ({ variableId, children }) => {
  const deleteVariable = api.deployment.variable.delete.useMutation();
  const router = useRouter();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you want to delete this variable?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will delete the variable and all of its values.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex justify-end">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <div className="flex-grow" />
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={() =>
              deleteVariable
                .mutateAsync(variableId)
                .then(() => router.refresh())
            }
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const VariableDropdown: React.FC<{
  variable: VariableData;
  children: React.ReactNode;
}> = ({ variable, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <EditVariableDialog
            variable={variable}
            onClose={() => setOpen(false)}
          >
            <DropdownMenuItem
              className="flex items-center gap-2"
              onSelect={(e) => e.preventDefault()}
            >
              <IconPencil className="h-4 w-4" />
              Edit
            </DropdownMenuItem>
          </EditVariableDialog>
          <AddVariableValueDialog variable={variable}>
            <DropdownMenuItem
              className="flex items-center gap-2"
              onSelect={(e) => e.preventDefault()}
            >
              <IconPlus className="h-4 w-4" />
              Add Value
            </DropdownMenuItem>
          </AddVariableValueDialog>
          <DeleteVariableDialog variableId={variable.id}>
            <DropdownMenuItem
              className="flex items-center gap-2"
              onSelect={(e) => e.preventDefault()}
            >
              <IconTrash className="h-4 w-4 text-red-500" />
              Delete
            </DropdownMenuItem>
          </DeleteVariableDialog>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
