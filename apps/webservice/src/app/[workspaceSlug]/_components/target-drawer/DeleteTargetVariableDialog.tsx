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

type DeleteTargetVariableDialogProps = {
  variableId: string;
  targetId: string;
  onClose: () => void;
  children: React.ReactNode;
};

export const DeleteTargetVariableDialog: React.FC<
  DeleteTargetVariableDialogProps
> = ({ variableId, targetId, onClose, children }) => {
  const [open, setOpen] = useState(false);
  const deleteTargetVariable = api.target.variable.delete.useMutation();
  const utils = api.useUtils();

  const onDelete = () =>
    deleteTargetVariable
      .mutateAsync(variableId)
      .then(() => utils.target.byId.invalidate(targetId))
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
          Deleting a target variable can change what values are passed to
          pipelines running for this target.
        </AlertDialogDescription>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <div className="flex-grow" />
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={onDelete}
            disabled={deleteTargetVariable.isPending}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
