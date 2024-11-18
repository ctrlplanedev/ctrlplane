"use client";

import type { Environment, System } from "@ctrlplane/db/schema";
import type { ColumnDef } from "@tanstack/react-table";
import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { IconDotsVertical } from "@tabler/icons-react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Button } from "@ctrlplane/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { SystemActionsDropdown } from "./SystemActionsDropdown";

const columns: ColumnDef<System & { environments: Environment[] }>[] = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    cell: (info) => info.getValue(),
  },
];

export const SystemsTable: React.FC<{
  systems: (System & { environments: Environment[] })[];
  workspaceSlug: string;
}> = ({ systems, workspaceSlug }) => {
  const router = useRouter();
  const table = useReactTable({
    data: systems,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
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
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            className="flex cursor-pointer items-center justify-between border-b-neutral-800/50 hover:bg-inherit"
            key={row.id}
          >
            {row.getVisibleCells().map((cell) => (
              <Fragment key={cell.id}>
                <TableCell
                  onClick={() =>
                    router.push(
                      `/${workspaceSlug}/systems/${row.original.slug}/deployments`,
                    )
                  }
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
                <TableCell>
                  <SystemActionsDropdown system={cell.row.original}>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <IconDotsVertical className="h-3 w-3" />
                    </Button>
                  </SystemActionsDropdown>
                </TableCell>
              </Fragment>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
