"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconAlertTriangle, IconTrash } from "@tabler/icons-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@ctrlplane/ui/alert-dialog";
import { Button } from "@ctrlplane/ui/button";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

type DeleteDeploymentSectionProps = {
  deployment: SCHEMA.Deployment;
  workspaceSlug: string;
  systemSlug: string;
};

export const DeleteDeploymentSection: React.FC<
  DeleteDeploymentSectionProps
> = ({ deployment, workspaceSlug, systemSlug }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const deleteDeployment = api.deployment.delete.useMutation();

  const handleDelete = () => {
    deleteDeployment
      .mutateAsync(deployment.id)
      .then(() =>
        router.push(urls.workspace(workspaceSlug).system(systemSlug).baseUrl()),
      )
      .catch((error) =>
        console.error(
          "Failed to delete deployment:",
          error instanceof Error ? error.message : error,
        ),
      );
  };
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="font-medium text-destructive">Delete Deployment</h3>
        <p className="text-sm text-muted-foreground">
          Permanently delete this deployment and all associated data. This
          action cannot be undone.
        </p>
      </div>

      <Button
        variant="destructive"
        size="sm"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        <IconTrash className="h-4 w-4" />
        Delete Deployment
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <IconAlertTriangle className="h-5 w-5" />
              <AlertDialogTitle>Delete Deployment</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Are you sure you want to delete the deployment "{deployment.name}
              "? This action cannot be undone and will remove all associated
              deployment data, jobs, and history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Deployment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
