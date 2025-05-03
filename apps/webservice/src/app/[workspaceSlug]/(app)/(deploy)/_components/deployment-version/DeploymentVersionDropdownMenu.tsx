"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconAlertTriangle,
  IconDotsVertical,
  IconReload,
} from "@tabler/icons-react";

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
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { api } from "~/trpc/react";

// Common type for deployment and environment props
type DeployProps = {
  deployment: { id: string; name: string };
  environment: { id: string; name: string };
  children: React.ReactNode;
};

export const RedeployVersionDialog: React.FC<DeployProps> = ({
  deployment,
  environment,
  children,
}) => {
  const router = useRouter();
  const redeploy = api.redeploy.useMutation();
  const [isOpen, setIsOpen] = useState(false);

  const handleRedeploy = () =>
    redeploy
      .mutateAsync({
        environmentId: environment.id,
        deploymentId: deployment.id,
      })
      .then(() => {
        setIsOpen(false);
        router.refresh();
      });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Redeploy{" "}
            <Badge variant="secondary" className="h-7 text-lg">
              {deployment.name}
            </Badge>{" "}
            to {environment.name}?
          </DialogTitle>
          <DialogDescription>
            This will redeploy the version to all resources in the environment.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button disabled={redeploy.isPending} onClick={handleRedeploy}>
            Redeploy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ForceDeployVersionDialog: React.FC<DeployProps> = ({
  deployment,
  environment,
  children,
}) => {
  const redeploy = api.redeploy.useMutation();
  const router = useRouter();

  const handleForceDeploy = () => {
    redeploy
      .mutateAsync({
        environmentId: environment.id,
        deploymentId: deployment.id,
        force: true,
      })
      .then(() => router.refresh());
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Force deploy {deployment.name} to {environment.name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will force the version to be deployed to all resources in the
            environment regardless of any policies set on the environment.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <div className="flex-grow" />
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={handleForceDeploy}
          >
            Force deploy
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

type DropdownActionProps = {
  deployment: { id: string; name: string };
  environment: { id: string; name: string };
  icon: React.ReactNode;
  label: string;
  Dialog: React.FC<DeployProps>;
};

export const DropdownAction: React.FC<DropdownActionProps> = ({
  deployment,
  environment,
  icon,
  label,
  Dialog,
}) => {
  return (
    <Dialog deployment={deployment} environment={environment}>
      <DropdownMenuItem
        onSelect={(e) => e.preventDefault()}
        className="space-x-2"
      >
        {icon}
        <span>{label}</span>
      </DropdownMenuItem>
    </Dialog>
  );
};

type DeploymentVersionDropdownMenuProps = {
  deployment: { id: string; name: string };
  environment: { id: string; name: string };
};

export const DeploymentVersionDropdownMenu: React.FC<
  DeploymentVersionDropdownMenuProps
> = ({ deployment, environment }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground"
      >
        <IconDotsVertical className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
      <DropdownAction
        deployment={deployment}
        environment={environment}
        icon={<IconReload className="h-4 w-4" />}
        label="Redeploy"
        Dialog={RedeployVersionDialog}
      />
      <DropdownAction
        deployment={deployment}
        environment={environment}
        icon={<IconAlertTriangle className="h-4 w-4" />}
        label="Force deploy"
        Dialog={ForceDeployVersionDialog}
      />
    </DropdownMenuContent>
  </DropdownMenu>
);
