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
import { Badge } from "@ctrlplane/ui/badge";

import { api } from "~/trpc/react";

export const LockReleaseDialog: React.FC<{
  deploymentId: string;
  environmentId: string;
  environmentName: string; // Add environment name as prop
  children: React.ReactNode;
}> = ({ deploymentId, environmentId, environmentName, children }) => {
  const router = useRouter();
  const unlockDeployment = api.deployment.unlock.useMutation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Unlock Deployment for{" "}
            <Badge variant="secondary" className="h-7 text-lg">
              {environmentName}
            </Badge>
            ?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to unlock this deployment? This action cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <div className="flex-grow" />
          <AlertDialogAction
            onClick={() =>
              unlockDeployment
                .mutateAsync({
                  deploymentId,
                  environmentId,
                })
                .then(() => {
                  setIsOpen(false);
                  router.refresh();
                })
            }
          >
            Unlock
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
