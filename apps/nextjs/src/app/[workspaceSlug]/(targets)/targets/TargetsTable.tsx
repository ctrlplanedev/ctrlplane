import type { Target } from "@ctrlplane/db/schema";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { formatDistanceToNowStrict } from "date-fns";
import { SiKubernetes } from "react-icons/si";
import { TbLock, TbServer, TbTarget } from "react-icons/tb";

import { cn } from "@ctrlplane/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

const columns: ColumnDef<Target>[] = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    cell: (info) => {
      const includes = (key: string) => info.row.original.version.includes(key);
      const isKube = includes("kubernetes");
      const isVm = includes("vm") || includes("compute");
      const isLocked = info.row.original.lockedAt != null;

      return (
        <div className="flex items-center gap-2 px-2 py-1">
          {isLocked ? (
            <TbLock className="shrink-0 text-red-300" />
          ) : isKube ? (
            <SiKubernetes className="shrink-0 text-blue-300" />
          ) : isVm ? (
            <TbServer className="shrink-0 text-cyan-300" />
          ) : (
            <TbTarget className="shrink-0 text-neutral-300" />
          )}
          {info.getValue<string>()}
        </div>
      );
    },
  },
  {
    id: "kind",
    header: "Kind",
    accessorKey: "kind",
    cell: (info) => info.getValue(),
  },
  {
    id: "updatedAt",
    header: "Last Sync",
    accessorKey: "updatedAt",
    cell: (info) => formatDistanceToNowStrict(info.getValue<Date>()),
  },
];

export const TargetsTable: React.FC<{
  activeTargetIds?: string[];
  targets: Target[];
  onTableRowClick?: (target: Target) => void;
}> = ({ targets, onTableRowClick, activeTargetIds }) => {
  const table = useReactTable({
    data: targets,
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
            className={cn(
              "cursor-pointer border-b-neutral-800/50",
              activeTargetIds?.includes(row.original.id) && "bg-neutral-800/50",
            )}
            key={row.id}
            onClick={() => {
              onTableRowClick?.(row.original);
            }}
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
