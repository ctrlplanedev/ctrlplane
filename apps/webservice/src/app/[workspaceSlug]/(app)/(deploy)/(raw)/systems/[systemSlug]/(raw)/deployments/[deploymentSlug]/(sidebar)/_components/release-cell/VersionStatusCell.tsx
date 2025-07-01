"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  IconAlertTriangle,
  IconBolt,
  IconDotsVertical,
  IconReload,
  IconSettings,
  IconTool,
  IconX,
} from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { toast } from "@ctrlplane/ui/toast";
import { DeploymentVersionStatus } from "@ctrlplane/validators/releases";

import { DropdownAction } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/DeploymentVersionDropdownMenu";
import { ForceDeployVersionDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/ForceDeployVersion";
import { RedeployVersionDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/RedeployVersionDialog";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import { Cell } from "./Cell";

const OverrideStatusDialog: React.FC<{
  deploymentVersion: SCHEMA.DeploymentVersion;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ deploymentVersion, onClose, children }) => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<DeploymentVersionStatus>(
    deploymentVersion.status as DeploymentVersionStatus,
  );

  const updateVersion = api.deployment.version.update.useMutation();
  const router = useRouter();

  const onSubmit = () =>
    updateVersion
      .mutateAsync({
        id: deploymentVersion.id,
        data: { status },
      })
      .then(() => toast.success("Version status updated"))
      .then(() => router.refresh())
      .then(() => setOpen(false))
      .then(() => onClose());

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose();
        setOpen(open);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="flex flex-col gap-6">
        <DialogHeader>
          <DialogTitle>Override Version Status</DialogTitle>
          <DialogDescription>
            Override the status of this version.
          </DialogDescription>
        </DialogHeader>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as DeploymentVersionStatus)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DeploymentVersionStatus.Building}>
              Building
            </SelectItem>
            <SelectItem value={DeploymentVersionStatus.Failed}>
              Failed
            </SelectItem>
            <SelectItem value={DeploymentVersionStatus.Rejected}>
              Rejected
            </SelectItem>
            <SelectItem value={DeploymentVersionStatus.Ready}>Ready</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex justify-between gap-2">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={onSubmit}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const VersionStatusDropdown: React.FC<{
  deploymentVersion: SCHEMA.DeploymentVersion;
  deployment: { id: string; name: string; slug: string };
  environment: { id: string; name: string };
}> = ({ deploymentVersion, deployment, environment }) => {
  const [open, setOpen] = useState(false);
  const isReady = deploymentVersion.status === "ready";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground"
        >
          <IconDotsVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <OverrideStatusDialog
          deploymentVersion={deploymentVersion}
          onClose={() => setOpen(false)}
        >
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex cursor-pointer items-center gap-2"
          >
            <IconSettings className="h-4 w-4" />
            Override status
          </DropdownMenuItem>
        </OverrideStatusDialog>
        {isReady && (
          <DropdownAction
            deployment={deployment}
            environment={environment}
            icon={<IconReload className="h-4 w-4" />}
            label="Redeploy"
            Dialog={RedeployVersionDialog}
          />
        )}
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
};

const StatusIcon: React.FC<{
  versionStatus: SCHEMA.DeploymentVersion["status"];
}> = ({ versionStatus }) => {
  const isBuilding = versionStatus === "building";
  if (isBuilding)
    return (
      <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
        <IconTool strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  const isFailed = versionStatus === "failed";
  if (isFailed)
    return (
      <div className="rounded-full bg-red-400 p-1 dark:text-black">
        <IconX strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  const isRejected = versionStatus === "rejected";
  if (isRejected)
    return (
      <div className="rounded-full bg-red-400 p-1 dark:text-black">
        <IconAlertTriangle strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  return (
    <div className="rounded-full bg-purple-400 p-1 dark:text-black">
      <IconBolt strokeWidth={2} className="h-4 w-4" />
    </div>
  );
};

export const VersionStatusCell: React.FC<{
  system: { id: string; slug: string };
  deployment: { id: string; name: string; slug: string };
  environment: { id: string; name: string };
  deploymentVersion: SCHEMA.DeploymentVersion;
}> = (props) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const versionUrl = urls
    .workspace(workspaceSlug)
    .system(props.system.slug)
    .deployment(props.deployment.slug)
    .release(props.deploymentVersion.id)
    .jobs();

  return (
    <Cell
      Icon={<StatusIcon versionStatus={props.deploymentVersion.status} />}
      url={versionUrl}
      tag={props.deploymentVersion.tag}
      label={props.deploymentVersion.status}
      Dropdown={<VersionStatusDropdown {...props} />}
    />
  );
};
