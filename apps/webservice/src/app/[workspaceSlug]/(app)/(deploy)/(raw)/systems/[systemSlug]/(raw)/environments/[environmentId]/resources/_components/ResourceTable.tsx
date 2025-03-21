import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";

import { Badge } from "@ctrlplane/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

type Resource = SCHEMA.Resource & {
  provider: SCHEMA.ResourceProvider | null;
};

export const ResourceRow: React.FC<{
  resource: Resource;
}> = ({ resource }) => (
  <TableRow
    key={resource.id}
    className="border-b border-neutral-800/50 hover:bg-neutral-800/20"
  >
    <TableCell className="py-3 font-medium text-neutral-200">
      {resource.name}
    </TableCell>
    <TableCell className="py-3 text-neutral-300">{resource.kind}</TableCell>
    <TableCell className="py-3 text-neutral-300">{resource.version}</TableCell>
    <TableCell className="py-3 text-neutral-300">
      {resource.providerId}
    </TableCell>
    <TableCell className="py-3 text-neutral-300">
      {resource.providerId}
    </TableCell>
    <TableCell className="py-3">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 rounded-full bg-neutral-800">
          <div className={`h-full rounded-full bg-green-500`} />
        </div>
        <span className="text-sm">100%</span>
      </div>
    </TableCell>
    <TableCell className="py-3 text-sm text-neutral-400">
      {resource.updatedAt?.toLocaleString()}
    </TableCell>
    <TableCell className="py-3">
      <Badge
        variant="outline"
        className={`bg-green-500/10 text-green-400`}
        // className={
        //   resource.status === "healthy"
        //     ? "border-green-500/30 bg-green-500/10 text-green-400"
        //     : resource.status === "degraded"
        //       ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
        //       : resource.status === "failed"
        //         ? "border-red-500/30 bg-red-500/10 text-red-400"
        //         : resource.status === "updating"
        //           ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
        //           : "border-neutral-500/30 bg-neutral-500/10 text-neutral-400"
        // }
      >
        Healthy
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
          <TableHead className="w-1/6 font-medium text-neutral-400">
            Component
          </TableHead>
          <TableHead className="w-1/12 font-medium text-neutral-400">
            Provider
          </TableHead>
          <TableHead className="w-1/12 font-medium text-neutral-400">
            Region
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
