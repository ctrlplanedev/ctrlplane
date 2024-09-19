"use client";

import type { System } from "@ctrlplane/db/schema";
import type { ColumnDef } from "@tanstack/react-table";
import { Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { TbDotsVertical } from "react-icons/tb";

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

const columns: ColumnDef<System>[] = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    cell: (info) => info.getValue(),
  },
];

export const SystemsTable: React.FC<{
  systems: System[];
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
            className="flex cursor-pointer justify-between border-b-neutral-800/50 hover:bg-inherit"
            key={row.id}
            onClick={() =>
              router.push(
                `/${workspaceSlug}/systems/${row.original.slug}/deployments`,
              )
            }
          >
            {row.getVisibleCells().map((cell) => (
              <Fragment key={cell.id}>
                <TableCell>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
                <TableCell>
                  <SystemActionsDropdown system={cell.row.original}>
                    <Button variant="ghost" size="icon">
                      <TbDotsVertical />
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
