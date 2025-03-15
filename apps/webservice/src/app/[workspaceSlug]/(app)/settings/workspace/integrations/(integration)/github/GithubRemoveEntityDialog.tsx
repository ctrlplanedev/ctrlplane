"use client";

import type * as schema from "@ctrlplane/db/schema";
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

type GithubRemoveEntityDialogProps = {
  githubEntity: schema.GithubEntity;
  children: React.ReactNode;
};

export const GithubRemoveEntityDialog: React.FC<
  GithubRemoveEntityDialogProps
> = ({ githubEntity, children }) => {
  const router = useRouter();
  const githubEntityDelete = api.github.entities.delete.useMutation();

  const { id, workspaceId } = githubEntity;
  const handleDelete = () =>
    githubEntityDelete
      .mutateAsync({ id, workspaceId })
      .then(() => router.refresh());

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you want to disconnect this Github organization?
          </AlertDialogTitle>

          <AlertDialogDescription>
            Disconnecting the organization will remove the connection between
            Ctrlplane and your Github organization for this workspace.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={handleDelete}
          >
            Disconnect
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
