"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";
import {
  defaultCondition,
  isEmptyCondition,
  isValidReleaseCondition,
  MAX_DEPTH_ALLOWED,
} from "@ctrlplane/validators/releases";

import { api } from "~/trpc/react";
import { ReleaseBadgeList } from "../ReleaseBadgeList";
import { ReleaseConditionRender } from "./ReleaseConditionRender";
import { useReleaseFilter } from "./useReleaseFilter";

type ReleaseConditionDialogProps = {
  condition: DeploymentVersionCondition | null;
  deploymentId?: string;
  onChange: (
    condition: DeploymentVersionCondition | null,
    deploymentVersionChannelId?: string | null,
  ) => void;
  deploymentVersionChannels?: SCHEMA.DeploymentVersionChannel[];
  children: React.ReactNode;
};

export const ReleaseConditionDialog: React.FC<ReleaseConditionDialogProps> = ({
  condition,
  deploymentId,
  onChange,
  deploymentVersionChannels = [],
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setFilter, deploymentVersionChannelId } = useReleaseFilter();

  const [localDeploymentVersionChannelId, setLocalDeploymentVersionChannelId] =
    useState<string | null>(deploymentVersionChannelId);

  const [localCondition, setLocalCondition] =
    useState<DeploymentVersionCondition | null>(condition ?? defaultCondition);
  const isLocalConditionValid =
    localCondition == null || isValidReleaseCondition(localCondition);
  const filter = localCondition ?? undefined;
  const releasesQ = api.deployment.version.list.useQuery(
    { deploymentId: deploymentId ?? "", filter, limit: 5 },
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
        <Tabs
          defaultValue={
            deploymentVersionChannelId != null
              ? "release-channels"
              : "new-filter"
          }
          className="space-y-4"
          onValueChange={(value) => {
            if (value === "new-filter")
              setLocalCondition(localCondition ?? defaultCondition);
            if (value === "release-channels")
              setLocalDeploymentVersionChannelId(deploymentVersionChannelId);
          }}
        >
          {deploymentVersionChannels.length > 0 && (
            <TabsList>
              <TabsTrigger value="release-channels">
                Release Channels
              </TabsTrigger>
              <TabsTrigger value="new-filter">New Filter</TabsTrigger>
            </TabsList>
          )}
          <TabsContent value="release-channels" className="space-y-4">
            <DialogHeader>
              <DialogTitle>Select Release Channel</DialogTitle>
              <DialogDescription>
                View releases by release channel.
              </DialogDescription>
            </DialogHeader>
            <Select
              value={localDeploymentVersionChannelId ?? undefined}
              onValueChange={(value) => {
                const deploymentVersionChannel = deploymentVersionChannels.find(
                  (rc) => rc.id === value,
                );
                if (deploymentVersionChannel == null) return;
                setLocalDeploymentVersionChannelId(value);
                setLocalCondition(deploymentVersionChannel.versionSelector);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select release channel..." />
              </SelectTrigger>
              <SelectContent>
                {deploymentVersionChannels.length === 0 && (
                  <SelectGroup>
                    <SelectLabel>No release channels found</SelectLabel>
                  </SelectGroup>
                )}
                {deploymentVersionChannels.map((rc) => (
                  <SelectItem key={rc.id} value={rc.id}>
                    {rc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button
                onClick={() => {
                  const deploymentVersionChannel =
                    deploymentVersionChannels.find(
                      (rc) => rc.id === localDeploymentVersionChannelId,
                    );
                  if (deploymentVersionChannel == null) return;
                  setFilter(
                    deploymentVersionChannel.versionSelector,
                    localDeploymentVersionChannelId,
                  );
                  setOpen(false);
                  setError(null);
                }}
                disabled={localDeploymentVersionChannelId == null}
              >
                Save
              </Button>
            </DialogFooter>
          </TabsContent>
          <TabsContent value="new-filter" className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit Release Condition</DialogTitle>
              <DialogDescription>
                Edit the release filter, up to a depth of{" "}
                {MAX_DEPTH_ALLOWED + 1}.
              </DialogDescription>
            </DialogHeader>
            <ReleaseConditionRender
              condition={localCondition ?? defaultCondition}
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
                  if (
                    localCondition != null &&
                    !isValidReleaseCondition(localCondition)
                  ) {
                    setError(
                      "Invalid release condition, ensure all fields are filled out correctly.",
                    );
                    return;
                  }
                  setOpen(false);
                  setError(null);

                  if (
                    localCondition != null &&
                    isEmptyCondition(localCondition)
                  ) {
                    onChange(null, null);
                    return;
                  }
                  onChange(localCondition, null);
                }}
              >
                Save
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
