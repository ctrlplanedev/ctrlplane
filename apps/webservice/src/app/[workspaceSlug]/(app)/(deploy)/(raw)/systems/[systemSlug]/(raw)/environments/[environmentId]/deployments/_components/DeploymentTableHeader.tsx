"use client";

import { TableHead, TableHeader, TableRow } from "@ctrlplane/ui/table";

export const DeploymentTableHeader: React.FC = () => (
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
);
