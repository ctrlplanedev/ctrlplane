"use client";

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

type DeleteHookDialogProps = {
  hookId: string;
  onClose: () => void;
  children: React.ReactNode;
};

export const DeleteHookDialog: React.FC<DeleteHookDialogProps> = ({
  hookId,
  onClose,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const deleteHook = api.deployment.hook.delete.useMutation();
  const utils = api.useUtils();
  const router = useRouter();

  const onDelete = () =>
    deleteHook
      .mutateAsync(hookId)
      .then(() => utils.deployment.hook.list.invalidate(hookId))
      .then(() => router.refresh())
      .then(() => setOpen(false))
      .then(() => onClose());

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
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you want to delete this hook?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDelete}
            disabled={deleteHook.isPending}
            className={buttonVariants({ variant: "destructive" })}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
