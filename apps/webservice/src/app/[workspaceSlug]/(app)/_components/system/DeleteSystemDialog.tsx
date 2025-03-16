"use client";

import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import { useParams, useRouter } from "next/navigation";

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
import { toast } from "@ctrlplane/ui/toast";

import { api } from "~/trpc/react";

type DeleteSystemProps = {
  system: schema.System;
  children: React.ReactNode;
  onSuccess?: () => void;
};

export const DeleteSystemDialog: React.FC<DeleteSystemProps> = ({
  system,
  children,
  onSuccess,
}) => {
  const router = useRouter();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const deleteSystem = api.system.delete.useMutation();

  const utils = api.useUtils();

  const onDelete = () =>
    deleteSystem
      .mutateAsync(system.id)
      .then(() => {
        utils.system.list.invalidate({
          workspaceId: system.workspaceId,
        });
        router.push(`/${workspaceSlug}/systems`);
        router.refresh();
        toast.success("System deleted successfully");
        onSuccess?.();
      })
      .catch(() => {
        toast.error("Failed to delete system");
      });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete System</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          Are you sure you want to delete the{" "}
          <span className="rounded-md bg-gray-900 px-2 py-1 text-gray-100">
            {system.name}
          </span>{" "}
          system? This action cannot be undone.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={onDelete}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
