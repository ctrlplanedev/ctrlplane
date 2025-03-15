import React, { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTrigger,
} from "@ctrlplane/ui/alert-dialog";
import { buttonVariants } from "@ctrlplane/ui/button";

import { api } from "~/trpc/react";

type DeleteResourceVariableDialogProps = {
  variableId: string;
  resourceId: string;
  onClose: () => void;
  children: React.ReactNode;
};

export const DeleteResourceVariableDialog: React.FC<
  DeleteResourceVariableDialogProps
> = ({ variableId, resourceId, onClose, children }) => {
  const [open, setOpen] = useState(false);
  const deleteResourceVariable = api.resource.variable.delete.useMutation();
  const utils = api.useUtils();

  const onDelete = () =>
    deleteResourceVariable
      .mutateAsync(variableId)
      .then(() => utils.resource.byId.invalidate(resourceId))
      .then(() => setOpen(false));

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onClose();
      }}
    >
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>Are you sure?</AlertDialogHeader>
        <AlertDialogDescription>
          Deleting a resource variable can change what values are passed to
          pipelines running for this resource.
        </AlertDialogDescription>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <div className="flex-grow" />
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={onDelete}
            disabled={deleteResourceVariable.isPending}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
