"use client";

import { useRouter } from "next/navigation";

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

type DeleteDeploymentProps = {
  id: string;
  name: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export const DeleteDeploymentDialog: React.FC<DeleteDeploymentProps> = ({
  id,
  name,
  isOpen,
  setIsOpen,
}) => {
  const router = useRouter();
  const deleteDeployment = api.deployment.delete.useMutation();
  const utils = api.useUtils();

  const onDelete = async () => {
    await deleteDeployment.mutateAsync(id);
    await utils.deployment.invalidate();
    router.refresh();
    setIsOpen(false);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Deployment</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          Are you sure you want to delete the{" "}
          <span className="rounded-md bg-gray-900 px-2 py-1 text-gray-100">
            {name}
          </span>{" "}
          deployment? This action cannot be undone.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
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
