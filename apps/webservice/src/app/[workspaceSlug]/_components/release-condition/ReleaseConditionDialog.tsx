"use client";

import type { ReleaseCondition } from "@ctrlplane/validators/releases";
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
  isValidReleaseCondition,
  MAX_DEPTH_ALLOWED,
} from "@ctrlplane/validators/releases";

import { api } from "~/trpc/react";
import { ReleaseBadgeList } from "../ReleaseBadgeList";
import { ReleaseConditionRender } from "./ReleaseConditionRender";

type ReleaseConditionDialogProps = {
  condition?: ReleaseCondition;
  deploymentId?: string;
  onChange: (condition: ReleaseCondition | undefined) => void;
  children: React.ReactNode;
};

export const ReleaseConditionDialog: React.FC<ReleaseConditionDialogProps> = ({
  condition,
  deploymentId,
  onChange,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localCondition, setLocalCondition] = useState(
    condition ?? defaultCondition,
  );
  const isLocalConditionValid = isValidReleaseCondition(localCondition);
  const releasesQ = api.release.list.useQuery(
    { deploymentId: deploymentId ?? "", filter: localCondition, limit: 5 },
    { enabled: deploymentId != null && isLocalConditionValid },
  );
  const releases = releasesQ.data;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="min-w-[1000px]"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Edit Release Condition</DialogTitle>
          <DialogDescription>
            Edit the release filter, up to a depth of {MAX_DEPTH_ALLOWED + 1}.
          </DialogDescription>
        </DialogHeader>
        <ReleaseConditionRender
          condition={localCondition}
          onChange={setLocalCondition}
        />
        {releases != null && <ReleaseBadgeList releases={releases} />}
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
              if (!isValidReleaseCondition(localCondition)) {
                setError(
                  "Invalid release condition, ensure all fields are filled out correctly.",
                );
                return;
              }
              onChange(localCondition);
              setOpen(false);
              setError(null);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
