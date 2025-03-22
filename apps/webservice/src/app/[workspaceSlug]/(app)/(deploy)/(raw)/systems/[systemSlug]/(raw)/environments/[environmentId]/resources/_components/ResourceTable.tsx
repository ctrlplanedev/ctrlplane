import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

const statusColor = {
  healthy: "bg-green-500/30 text-green-400 border-green-400",
  unhealthy: "bg-red-500/30 text-red-400 border-red-400",
  deploying: "bg-blue-500/30 text-blue-400 border-blue-400",
};

type ResourceStatus = keyof typeof statusColor;

type Resource = SCHEMA.Resource & {
  status: ResourceStatus;
  successRate: number;
};

export const ResourceRow: React.FC<{
  resource: Resource;
}> = ({ resource }) => (
  <TableRow
    key={resource.id}
    className="border-b border-neutral-800/50 hover:bg-neutral-800/20"
  >
    <TableCell className="truncate py-3 font-medium text-neutral-200">
      {resource.name}
    </TableCell>
    <TableCell className="truncate py-3 text-neutral-300">
      {resource.kind}
    </TableCell>
    <TableCell className="truncate py-3 text-neutral-300">
      {resource.version}
    </TableCell>
    <TableCell className="truncate py-3 text-neutral-300">
      {resource.providerId}
    </TableCell>
    <TableCell className="py-3">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 rounded-full bg-neutral-800">
          <div
            style={{ width: `${resource.successRate * 100}%` }}
            className={cn(
              "h-full rounded-full",
              resource.successRate >= 0.9
                ? "bg-green-500"
                : resource.successRate >= 0.5
                  ? "bg-yellow-500"
                  : "bg-red-500",
            )}
          />
        </div>
        <span className="text-sm">
          {(resource.successRate * 100).toFixed(0)}%
        </span>
      </div>
    </TableCell>
    <TableCell className="truncate py-3 text-sm text-neutral-400">
      {resource.updatedAt?.toLocaleString()}
    </TableCell>
    <TableCell className="py-3">
      <Badge variant="outline" className={statusColor[resource.status]}>
        {resource.status}
      </Badge>
    </TableCell>
  </TableRow>
);

export const ResourceTable: React.FC<{
  resources: Resource[];
}> = ({ resources }) => (
  <div className="overflow-hidden rounded-md border border-neutral-800">
    <Table>
      <TableHeader>
        <TableRow className="border-b border-neutral-800 hover:bg-transparent">
          <TableHead className="w-1/6 font-medium text-neutral-400">
            Name
          </TableHead>
          <TableHead className="w-1/12 font-medium text-neutral-400">
            Kind
          </TableHead>

          <TableHead className="w-1/12 font-medium text-neutral-400">
            Version
          </TableHead>

          <TableHead className="w-1/12 font-medium text-neutral-400">
            Provider
          </TableHead>

          <TableHead className="w-1/12 font-medium text-neutral-400">
            Success Rate
          </TableHead>
          <TableHead className="w-1/6 font-medium text-neutral-400">
            Last Updated
          </TableHead>
          <TableHead className="w-1/12 font-medium text-neutral-400">
            Status
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {resources.map((resource) => (
          <ResourceRow key={resource.id} resource={resource} />
        ))}
      </TableBody>
    </Table>
  </div>
);
