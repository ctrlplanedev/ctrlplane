"use client";

import type { Resource } from "@ctrlplane/db/schema";
import type { ColumnDef } from "@tanstack/react-table";
import { IconLock, IconX } from "@tabler/icons-react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { formatDistanceToNowStrict } from "date-fns";

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

import { TargetIcon } from "~/app/[workspaceSlug]/(app)/_components/TargetIcon";
import { api } from "~/trpc/react";

const columns: ColumnDef<Resource>[] = [
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
          "opacity-0 transition-opacity group-hover:opacity-100",
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
          "opacity-0 transition-opacity group-hover:opacity-100",
          row.getIsSelected() && "opacity-100",
        )}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 10,
    enableResizing: false,
  },
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    cell: (info) => {
      const isLocked = info.row.original.lockedAt != null;
      return (
        <div className="flex items-center gap-2 px-2 py-1">
          {isLocked && <IconLock className="h-4 w-4 shrink-0 text-red-300" />}
          {!isLocked && (
            <TargetIcon
              version={info.row.original.version}
              kind={info.row.original.kind}
            />
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
    cell: (info) =>
      info.getValue() != null
        ? formatDistanceToNowStrict(info.getValue<Date>())
        : "",
  },
];

export const TargetsTable: React.FC<{
  activeTargetIds?: string[];
  targets: Resource[];
  onTableRowClick?: (target: Resource) => void;
}> = ({ targets, onTableRowClick, activeTargetIds }) => {
  const deleteTargetsMutation = api.resource.delete.useMutation();

  const table = useReactTable({
    data: targets,
    columns,
    defaultColumn: {
      minSize: 0,
      size: Number.MAX_SAFE_INTEGER,
      maxSize: Number.MAX_SAFE_INTEGER,
    },
    getCoreRowModel: getCoreRowModel(),
  });

  const utils = api.useUtils();
  const handleDeleteTargets = async () => {
    const selectedTargets = table
      .getSelectedRowModel()
      .rows.map((row) => row.original.id);
    await deleteTargetsMutation.mutateAsync(selectedTargets);
    await utils.resource.byWorkspaceId.invalidate();
    table.toggleAllRowsSelected(false);
  };

  return (
    <div className="relative">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="group">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  style={{
                    width:
                      header.getSize() === Number.MAX_SAFE_INTEGER
                        ? "auto"
                        : header.getSize(),
                  }}
                >
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
                "group cursor-pointer border-b-neutral-800/50",
                activeTargetIds?.includes(row.original.id) &&
                  "bg-neutral-800/50",
                row.getIsSelected() && "bg-blue-500/20",
                row.getIsSelected() && "hover:bg-blue-500/30",
              )}
              key={row.id}
              onClick={() => onTableRowClick?.(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  style={{
                    width:
                      cell.column.getSize() === Number.MAX_SAFE_INTEGER
                        ? "auto"
                        : cell.column.getSize(),
                  }}
                >
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
              <IconX className="h-4 w-4" />
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
