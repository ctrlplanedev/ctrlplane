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

import type { DeployProps } from "./deploy-props";
import { api } from "~/trpc/react";

export const ForceDeployVersionDialog: React.FC<DeployProps> = ({
  deployment,
  environment,
  resource,
  children,
}) => {
  const redeploy = api.redeploy.useMutation();
  const router = useRouter();

  const environmentId = environment.id;
  const deploymentId = deployment.id;
  const resourceId = resource?.id;
  const handleForceDeploy = () =>
    redeploy
      .mutateAsync({ environmentId, deploymentId, resourceId, force: true })
      .then(() => router.refresh());

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Force deploy {deployment.name} to{" "}
            {resource != null ? resource.name : environment.name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {resource != null
              ? "This will force the version to be deployed to the resource regardless of any policies set on the resource."
              : "This will force the version to be deployed to all resources in the environment regardless of any policies set on the environment."}
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
