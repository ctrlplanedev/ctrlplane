"use client";

import type { System } from "@ctrlplane/db/schema";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

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
            className="cursor-pointer border-b-neutral-800/50"
            key={row.id}
            onClick={() =>
              router.push(
                `/${workspaceSlug}/systems/${row.original.slug}/deployments`,
              )
            }
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
