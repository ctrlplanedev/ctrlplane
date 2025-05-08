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
  children,
}) => {
  const router = useRouter();
  const redeploy = api.redeploy.useMutation();
  const [isOpen, setIsOpen] = useState(false);

  const environmentId = environment.id;
  const deploymentId = deployment.id;
  const handleRedeploy = () =>
    redeploy
      .mutateAsync({ environmentId, deploymentId })
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
