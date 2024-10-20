import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";
import { useRouter } from "next/navigation";
import { IconDotsVertical, IconTrash } from "@tabler/icons-react";

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
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { api } from "~/trpc/react";
import { useVariableSetDrawer } from "./useVariableSetDrawer";

type DeleteVariableSetDialogProps = {
  variableSetId: string;
  children: React.ReactNode;
};

export const DeleteVariableSetDialog: React.FC<
  DeleteVariableSetDialogProps
> = ({ variableSetId, children }) => {
  const deleteVariableSet = api.variableSet.delete.useMutation();
  const { removeVariableSetId } = useVariableSetDrawer();
  const router = useRouter();

  const onDelete = () =>
    deleteVariableSet
      .mutateAsync(variableSetId)
      .then(() => removeVariableSetId())
      .then(() => router.refresh());

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you want to delete this variable set?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <div className="flex-grow" />
          <AlertDialogAction
            onClick={onDelete}
            className={buttonVariants({ variant: "destructive" })}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

type VariableSetActionsDropdownProps = {
  variableSet: SCHEMA.VariableSet;
};

export const VariableSetActionsDropdown: React.FC<
  VariableSetActionsDropdownProps
> = ({ variableSet }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" className="size-8 p-0">
        <IconDotsVertical className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DeleteVariableSetDialog variableSetId={variableSet.id}>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          className="flex items-center gap-2"
        >
          <IconTrash className="h-4 w-4 text-red-500" />
          Delete
        </DropdownMenuItem>
      </DeleteVariableSetDialog>
    </DropdownMenuContent>
  </DropdownMenu>
);
