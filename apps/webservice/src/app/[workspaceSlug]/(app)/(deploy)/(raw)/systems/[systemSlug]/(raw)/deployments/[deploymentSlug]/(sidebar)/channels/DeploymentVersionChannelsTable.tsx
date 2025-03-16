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
  releaseChannels: DeploymentVersionChannel[];
};

export const DeploymentVersionChannelsTable: React.FC<
  DeploymentVersionChannelTableProps
> = ({ releaseChannels }) => {
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
        {releaseChannels.map((releaseChannel) => (
          <TableRow
            key={releaseChannel.id}
            className="cursor-pointer"
            onClick={() => setDeploymentVersionChannelId(releaseChannel.id)}
          >
            <TableCell>{releaseChannel.name}</TableCell>
            <TableCell>{releaseChannel.description}</TableCell>
            <TableCell>
              {releaseChannel.releaseFilter != null && (
                <ReleaseConditionBadge
                  condition={releaseChannel.releaseFilter}
                />
              )}
            </TableCell>
            <TableCell>{releaseChannel.total}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
