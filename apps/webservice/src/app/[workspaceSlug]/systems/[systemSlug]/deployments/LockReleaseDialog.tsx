"use client";

import { useState } from "react";

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
  deployment: { id: string; slug: string };
  environment: { id: string; name: string };
  children: React.ReactNode;
  isLocked: boolean;
  onLockChange: () => void;
}> = ({ deployment, environment, children, isLocked, onLockChange }) => {
  const unlockDeployment = api.deployment.unlock.useMutation();
  const lockDeployment = api.deployment.lock.useMutation();
  const [isOpen, setIsOpen] = useState(false);

  const handleUnlock = () =>
    unlockDeployment
      .mutateAsync({
        deploymentId: deployment.id,
        environmentId: environment.id,
      })
      .then(() => {
        setIsOpen(false);
        onLockChange();
      });

  const handleLock = () =>
    lockDeployment
      .mutateAsync({
        deploymentId: deployment.id,
        environmentId: environment.id,
      })
      .then(() => {
        setIsOpen(false);
        onLockChange();
      });

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isLocked ? "Unlock Deployments for " : "Lock Deployments for "}
            <Badge variant="secondary" className="h-7 text-lg">
              {environment.name}
            </Badge>
            {" Environment?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {`Are you sure you want to ${isLocked ? "unlock" : "lock"} this deployment? This will block further releases to this environment.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <div className="flex-grow" />
          <AlertDialogAction onClick={isLocked ? handleUnlock : handleLock}>
            {isLocked ? "Unlock" : "Lock"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
