"use client";

import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import React, { useState } from "react";

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
import {
  defaultCondition,
  isEmptyCondition,
  isValidDeploymentVersionCondition,
  MAX_DEPTH_ALLOWED,
} from "@ctrlplane/validators/releases";

import { api } from "~/trpc/react";
import { DeploymentVersionBadgeList } from "../DeploymentVersionBadgeList";
import { DeploymentVersionConditionRender } from "./DeploymentVersionConditionRender";

type DeploymentVersionConditionDialogProps = {
  condition: DeploymentVersionCondition | null;
  deploymentId?: string;
  onChange: (condition: DeploymentVersionCondition | null) => void;
  children: React.ReactNode;
};

export const DeploymentVersionConditionDialog: React.FC<
  DeploymentVersionConditionDialogProps
> = ({ condition, deploymentId, onChange, children }) => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [localCondition, setLocalCondition] =
    useState<DeploymentVersionCondition | null>(condition ?? defaultCondition);
  const isLocalConditionValid =
    localCondition == null || isValidDeploymentVersionCondition(localCondition);
  const selector = localCondition ?? undefined;
  const versionsQ = api.deployment.version.list.useQuery(
    { deploymentId: deploymentId ?? "", filter: selector, limit: 5 },
    { enabled: deploymentId != null && isLocalConditionValid },
  );
  const versions = versionsQ.data;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="min-w-[1000px]"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Edit Deployment Version Selector</DialogTitle>
          <DialogDescription>
            Edit the deployment version selector, up to a depth of{" "}
            {MAX_DEPTH_ALLOWED + 1}.
          </DialogDescription>
        </DialogHeader>
        <DeploymentVersionConditionRender
          condition={localCondition ?? defaultCondition}
          onChange={setLocalCondition}
        />
        {versions != null && <DeploymentVersionBadgeList versions={versions} />}
        {error && <span className="text-sm text-red-600">{error}</span>}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setLocalCondition(defaultCondition);
              setError(null);
            }}
          >
            Clear
          </Button>
          <div className="flex-grow" />
          <Button
            onClick={() => {
              if (
                localCondition != null &&
                !isValidDeploymentVersionCondition(localCondition)
              ) {
                setError(
                  "Invalid version selector, ensure all fields are filled out correctly.",
                );
                return;
              }
              setOpen(false);
              setError(null);

              if (localCondition != null && isEmptyCondition(localCondition)) {
                onChange(null);
                return;
              }
              onChange(localCondition);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
