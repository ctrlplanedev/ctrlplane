import type * as SCHEMA from "@ctrlplane/db/schema";
import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

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

import { api } from "~/trpc/react";

type DeleteRunbookDialogProps = {
  runbook: SCHEMA.Runbook;
  onClose: () => void;
  children: React.ReactNode;
};

export const DeleteRunbookDialog: React.FC<DeleteRunbookDialogProps> = ({
  runbook,
  onClose,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const deleteRunbook = api.runbook.delete.useMutation();
  const router = useRouter();

  const handleDelete = () =>
    deleteRunbook
      .mutateAsync(runbook.id)
      .then(() => router.refresh())
      .then(() => setIsOpen(false));

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(o) => {
        setIsOpen(o);
        if (!o) onClose();
      }}
    >
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Runbook</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this runbook?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className={buttonVariants({ variant: "destructive" })}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
