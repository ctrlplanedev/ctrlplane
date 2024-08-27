"use client";

import { useParams, useRouter } from "next/navigation";
import { z } from "zod";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@ctrlplane/ui/alert-dialog";
import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/react";

const deleteDeploymentSchema = z.object({
  deploymentId: z.string().uuid(),
});

type DeleteDeploymentProps = {
  deploymentId: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export const DeleteDeploymentDialog: React.FC<DeleteDeploymentProps> = ({
  deploymentId,
  isOpen,
  setIsOpen,
}) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const router = useRouter();
  const deleteDeployment = api.deployment.delete.useMutation();
  const utils = api.useUtils();

  const onDelete = async () => {
    const validation = deleteDeploymentSchema.safeParse({ deploymentId });

    if (!validation.success) {
      console.error("Invalid deployment ID:", deploymentId);
      return;
    }
    await deleteDeployment.mutateAsync(deploymentId);
    await utils.deployment.invalidate();
    router.push(`/${workspaceSlug}/systems`);
    setIsOpen(false);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Deployment</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          Are you sure you want to delete this deployment? This action cannot be
          undone.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <Button variant="secondary" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
