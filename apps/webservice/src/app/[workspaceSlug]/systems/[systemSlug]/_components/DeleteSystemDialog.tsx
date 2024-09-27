"use client";

import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import { useParams, useRouter } from "next/navigation";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogDestructiveAction,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ctrlplane/ui/alert-dialog";

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

  const onDelete = () => {
    deleteSystem
      .mutateAsync(system.id)
      .then(() => {
        router.push(`/${workspaceSlug}/systems`);
        router.refresh();
        onSuccess?.();
      })
      .catch((error) => {
        console.error(error);
      });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
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
          <AlertDialogDestructiveAction onClick={onDelete}>
            Delete
          </AlertDialogDestructiveAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
