"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { useDeploymentVersionChannelDrawer } from "~/app/[workspaceSlug]/(app)/_components/channel/drawer/useDeploymentVersionChannelDrawer";
import { ReleaseConditionBadge } from "~/app/[workspaceSlug]/(app)/_components/release/condition/ReleaseConditionBadge";

type DeploymentVersionChannel = SCHEMA.DeploymentVersionChannel & {
  total: number;
};

type DeploymentVersionChannelTableProps = {
  deploymentVersionChannels: DeploymentVersionChannel[];
};

export const DeploymentVersionChannelsTable: React.FC<
  DeploymentVersionChannelTableProps
> = ({ deploymentVersionChannels }) => {
  const { setDeploymentVersionChannelId } = useDeploymentVersionChannelDrawer();
  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Release Filter</TableHead>
          <TableHead>Total Releases</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deploymentVersionChannels.map((deploymentVersionChannel) => (
          <TableRow
            key={deploymentVersionChannel.id}
            className="cursor-pointer"
            onClick={() =>
              setDeploymentVersionChannelId(deploymentVersionChannel.id)
            }
          >
            <TableCell>{deploymentVersionChannel.name}</TableCell>
            <TableCell>{deploymentVersionChannel.description}</TableCell>
            <TableCell>
              {deploymentVersionChannel.versionSelector != null && (
                <ReleaseConditionBadge
                  condition={deploymentVersionChannel.versionSelector}
                />
              )}
            </TableCell>
            <TableCell>{deploymentVersionChannel.total}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
