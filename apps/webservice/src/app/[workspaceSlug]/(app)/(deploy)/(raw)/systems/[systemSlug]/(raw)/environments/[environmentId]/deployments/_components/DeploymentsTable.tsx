import React from "react";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import type { DeploymentStat } from "./types";
import { DeploymentRow } from "./DeploymentRow";
import { SkeletonRow } from "./SkeletonRow";

interface DeploymentsTableProps {
  deploymentStats: DeploymentStat[];
  isLoading: boolean;
}

export const DeploymentsTable: React.FC<DeploymentsTableProps> = ({
  deploymentStats,
  isLoading,
}) => {
  return (
    <div className="rounded-md border border-neutral-800">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="border-b border-neutral-800 hover:bg-transparent">
            <TableHead className="w-1/5 font-medium text-neutral-400">
              Component
            </TableHead>
            <TableHead className="w-1/6 font-medium text-neutral-400">
              Version
            </TableHead>
            <TableHead className="w-1/12 font-medium text-neutral-400">
              Status
            </TableHead>
            <TableHead className="w-1/12 font-medium text-neutral-400">
              Resources
            </TableHead>
            <TableHead className="w-1/12 font-medium text-neutral-400">
              Duration
            </TableHead>
            <TableHead className="w-1/8 font-medium text-neutral-400">
              Success Rate
            </TableHead>
            <TableHead className="w-1/8 truncate font-medium text-neutral-400">
              Deployed By
            </TableHead>
            <TableHead className="w-1/12 font-medium text-neutral-400">
              Timestamp
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 3 }).map((_, index) => (
              <SkeletonRow key={index} />
            ))}
          {deploymentStats.map((deploymentStat) => (
            <DeploymentRow
              key={deploymentStat.deployment.id}
              deploymentStat={deploymentStat}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
