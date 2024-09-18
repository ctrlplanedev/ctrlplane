"use client";

import type { JobAgent } from "@ctrlplane/db/schema";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { cn } from "@ctrlplane/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

const columns: ColumnDef<JobAgent>[] = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    cell: (info) => {
      return (
        <div className="flex items-center gap-2 px-2 py-1">
          {info.getValue<string>()}
        </div>
      );
    },
  },
  {
    id: "type",
    header: "Type",
    accessorKey: "type",
    cell: (info) => info.getValue(),
  },
];

export const JobAgentsTable: React.FC<{
  activeTargetIds?: string[];
  jobAgents: JobAgent[];
  onTableRowClick?: (target: JobAgent) => void;
}> = ({ jobAgents, onTableRowClick, activeTargetIds }) => {
  const table = useReactTable({
    data: jobAgents,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} className="text-xs">
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody className="border-b">
        {table.getRowModel().rows.map((row) => (
          <TableRow
            className={cn(
              "cursor-pointer border-b-neutral-800/50",
              activeTargetIds?.includes(row.original.id) && "bg-neutral-800/50",
            )}
            key={row.id}
            onClick={() => onTableRowClick?.(row.original)}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
