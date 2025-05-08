"use client";

import {
  IconAlertTriangle,
  IconDotsVertical,
  IconReload,
} from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import type { DeployProps } from "./deploy-props";
import { ForceDeployVersionDialog } from "./ForceDeployVersion";
import { RedeployVersionDialog } from "./RedeployVersionDialog";

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
