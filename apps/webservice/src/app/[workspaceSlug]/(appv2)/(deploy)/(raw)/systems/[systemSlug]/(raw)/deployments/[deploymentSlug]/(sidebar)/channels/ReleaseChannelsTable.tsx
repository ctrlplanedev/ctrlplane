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

import { useReleaseChannelDrawer } from "~/app/[workspaceSlug]/(appv2)/_components/channel/drawer/useReleaseChannelDrawer";
import { ReleaseConditionBadge } from "~/app/[workspaceSlug]/(appv2)/_components/release/condition/ReleaseConditionBadge";

type ReleaseChannel = SCHEMA.DeploymentVersionChannel & { total: number };

type ReleaseChannelTableProps = { releaseChannels: ReleaseChannel[] };

export const ReleaseChannelsTable: React.FC<ReleaseChannelTableProps> = ({
  releaseChannels,
}) => {
  const { setReleaseChannelId } = useReleaseChannelDrawer();
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
            onClick={() => setReleaseChannelId(releaseChannel.id)}
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
