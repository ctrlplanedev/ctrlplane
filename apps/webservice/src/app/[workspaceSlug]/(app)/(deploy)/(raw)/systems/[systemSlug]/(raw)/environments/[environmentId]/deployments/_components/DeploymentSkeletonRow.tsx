"use client";

import { Skeleton } from "@ctrlplane/ui/skeleton";
import { TableCell, TableRow } from "@ctrlplane/ui/table";

export const DeploymentSkeletonRow: React.FC = () => (
  <TableRow className="h-12">
    {Array.from({ length: 8 }).map((_, index) => (
      <TableCell key={index}>
        <Skeleton className="h-4 w-20" />
      </TableCell>
    ))}
  </TableRow>
);
