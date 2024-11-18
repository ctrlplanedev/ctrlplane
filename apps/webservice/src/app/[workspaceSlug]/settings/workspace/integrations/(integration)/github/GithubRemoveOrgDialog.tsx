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

type GithubRemoveOrgDialogProps = {
  githubOrganization: schema.GithubOrganization;
  children: React.ReactNode;
};

export const GithubRemoveOrgDialog: React.FC<GithubRemoveOrgDialogProps> = ({
  githubOrganization,
  children,
}) => {
  const router = useRouter();
  const githubOrgDelete = api.github.organizations.delete.useMutation();

  const { id, workspaceId } = githubOrganization;
  const handleDelete = () =>
    githubOrgDelete
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
