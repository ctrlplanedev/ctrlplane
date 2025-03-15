import type * as SCHEMA from "@ctrlplane/db/schema";

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
import { useEnvironmentPolicyDrawer } from "./EnvironmentPolicyDrawer";

export const DeleteEnvironmentPolicyDialog: React.FC<{
  environmentPolicy: SCHEMA.EnvironmentPolicy;
  children: React.ReactNode;
}> = ({ environmentPolicy, children }) => {
  const deleteEnvironmentPolicy = api.environment.policy.delete.useMutation();
  const utils = api.useUtils();
  const { removeEnvironmentPolicyId } = useEnvironmentPolicyDrawer();

  const { id, systemId } = environmentPolicy;
  const onDelete = () =>
    deleteEnvironmentPolicy
      .mutateAsync(id)
      .then(removeEnvironmentPolicyId)
      .then(() => utils.environment.policy.bySystemId.invalidate(systemId));

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Environment Policy</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          Are you sure you want to delete this environment policy? You will have
          to recreate it from scratch.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDelete}
            className={buttonVariants({ variant: "destructive" })}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
