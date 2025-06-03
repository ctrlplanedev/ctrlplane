"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";

import type { DeployProps } from "./deploy-props";
import { api } from "~/trpc/react";

export const RedeployVersionDialog: React.FC<DeployProps> = ({
  deployment,
  environment,
  resource,
  children,
}) => {
  const router = useRouter();
  const redeploy = api.redeploy.useMutation();
  const [isOpen, setIsOpen] = useState(false);

  const environmentId = environment.id;
  const deploymentId = deployment.id;
  const resourceId = resource?.id;

  const handleRedeploy = () =>
    redeploy
      .mutateAsync({ environmentId, deploymentId, resourceId })
      .then(() => setIsOpen(false))
      .then(() => router.refresh());

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
            to {resource != null ? resource.name : environment.name}?
          </DialogTitle>
          <DialogDescription>
            {resourceId != null
              ? "This will redeploy the version to the resource."
              : "This will redeploy the version to all resources in the environment."}
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
