"use client";

import type { Target } from "@ctrlplane/db/schema";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { formatDistanceToNowStrict } from "date-fns";
import { SiKubernetes } from "react-icons/si";
import { TbLock, TbServer, TbTarget, TbX } from "react-icons/tb";

import { cn } from "@ctrlplane/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ctrlplane/ui/alert-dialog";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import { Checkbox } from "@ctrlplane/ui/checkbox";
import { Separator } from "@ctrlplane/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { api } from "~/trpc/react";

const columns: ColumnDef<Target>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsSomePageRowsSelected()
            ? "indeterminate"
            : table.getIsAllPageRowsSelected()
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className={cn(
          "opacity-0 transition-opacity hover:opacity-100",
          (table.getIsAllPageRowsSelected() ||
            table.getIsSomePageRowsSelected()) &&
            "opacity-100",
        )}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        onClick={(e) => e.stopPropagation()}
        aria-label="Select row"
        className={cn(
          "opacity-0 transition-opacity hover:opacity-100",
          row.getIsSelected() && "opacity-100",
        )}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 40, // Set a fixed width for the checkbox column
  },
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
  const deleteTargetsMutation = api.target.delete.useMutation();

  const table = useReactTable({
    data: targets,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const utils = api.useUtils();
  const handleDeleteTargets = async () => {
    const selectedTargets = table
      .getSelectedRowModel()
      .rows.map((row) => row.original.id);
    await deleteTargetsMutation.mutateAsync(selectedTargets);
    await utils.target.byWorkspaceId.invalidate();
    table.toggleAllRowsSelected(false);
  };

  return (
    <div className="relative">
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
                activeTargetIds?.includes(row.original.id) &&
                  "bg-neutral-800/50",
                row.getIsSelected() && "bg-blue-500/20",
                row.getIsSelected() && "hover:bg-blue-500/30",
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
      {table.getSelectedRowModel().rows.length > 0 && (
        <div className="sticky bottom-4 left-0 right-0 flex justify-center">
          <div className="flex items-center gap-2 rounded-md bg-neutral-900 p-2 shadow-lg">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.toggleAllRowsSelected(false)}
              className="flex items-center gap-2 bg-transparent"
            >
              <span className="text-sm text-muted-foreground">
                {table.getSelectedRowModel().rows.length} selected
              </span>
              <TbX className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 bg-transparent"
                >
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete
                    the selected targets.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className={buttonVariants({ variant: "destructive" })}
                    onClick={handleDeleteTargets}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );
};
