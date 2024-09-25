/* eslint-disable react-hooks/rules-of-hooks */
"use client";

import type { EntityRole, Role, User, Workspace } from "@ctrlplane/db/schema";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck, IconCopy, IconDots } from "@tabler/icons-react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useCopyToClipboard } from "react-use";
import { v4 } from "uuid";

import { Avatar, AvatarFallback, AvatarImage } from "@ctrlplane/ui/avatar";
import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { Input } from "@ctrlplane/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { Table, TableBody, TableCell, TableRow } from "@ctrlplane/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";
import { predefinedRoles } from "@ctrlplane/validators/auth";

import { api } from "~/trpc/react";

type Member = {
  id: string;
  user: User;
  workspace: Workspace;
  entityRole: EntityRole;
  role: Role;
};

const InviteLinkSection: React.FC<{
  workspace: Workspace;
  inviteLink?: string;
}> = ({ workspace, inviteLink }) => {
  const create = api.workspace.invite.token.create.useMutation();

  const [, copy] = useCopyToClipboard();
  const [clickedCopy, setClickedCopy] = useState(false);
  const [roleId, setRoleId] = useState(predefinedRoles.admin.id);

  const token = useMemo(() => inviteLink ?? v4(), [inviteLink]);
  const baseUrl = api.runtime.baseUrl.useQuery();
  const link = `${baseUrl.data}/join/${token}`;

  const roles = api.workspace.roles.useQuery(workspace.id);

  const handleCopyClick = () => {
    copy(link);
    setClickedCopy(true);
    setTimeout(() => setClickedCopy(false), 1000);
    create.mutate({ roleId, workspaceId: workspace.id, token });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="font-semibold">Invite link</p>
        <p className="text-sm text-muted-foreground">
          Share this link to invite members to your workspace.
        </p>
      </div>

      <Select value={roleId} onValueChange={setRoleId}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select a role" />
        </SelectTrigger>
        <SelectContent className="w-[200px]">
          {roles.data?.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center space-x-2">
        <Input readOnly value={link} className="w-96 overflow-ellipsis" />
        <Button variant="outline" size="icon" onClick={handleCopyClick}>
          {clickedCopy ? (
            <IconCheck className="text-green-600" />
          ) : (
            <IconCopy />
          )}
        </Button>
      </div>
    </div>
  );
};

const AddMembersDialog: React.FC<{
  workspace: Workspace;
}> = ({ workspace }) => {
  const [inviteMode, setInviteMode] = useState<"email" | "link">("link");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">Add member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to {workspace.name}</DialogTitle>
        </DialogHeader>

        {inviteMode === "link" ? (
          <InviteLinkSection workspace={workspace} />
        ) : (
          <div>email</div>
        )}

        <DialogFooter className="flex justify-between">
          <div className="flex-grow">
            <Button
              variant="secondary"
              onClick={() =>
                setInviteMode(inviteMode === "email" ? "link" : "email")
              }
              className="w-36"
            >
              Invite with {inviteMode === "email" ? "link" : "email"}
            </Button>
          </div>

          {inviteMode === "email" && <Button>Invite</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const columns: ColumnDef<Member>[] = [
  {
    id: "email",
    header: "Email",
    accessorKey: "user.email",
    cell: (info) => (
      <div className="flex items-center space-x-4">
        <Avatar className="h-9 w-9">
          <AvatarImage src={info.row.original.user.image ?? ""} />
          <AvatarFallback>
            {info.row.original.user.name?.split(" ").map((n) => n[0]) ?? ""}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold">{info.row.original.user.name ?? ""}</p>
          <p className="text-sm text-muted-foreground">
            {info.getValue<string>()}
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "name",
    header: "Name",
    accessorKey: "user.name",
  },
  {
    id: "role",
    header: "Role",
    accessorKey: "role",
    enableGlobalFilter: false,
    cell: ({ row }) => {
      const viewer = api.user.viewer.useQuery();
      const { id: currentRoleId } = row.original.role;
      const { id: entityRoleId } = row.original.entityRole;
      const roles = api.workspace.roles.useQuery(row.original.workspace.id);
      const updateRole = api.workspace.iam.set.useMutation();
      const router = useRouter();
      const isCurrentUser = row.original.user.id === viewer.data?.id;

      const handleRoleChange = (newRoleId: string) => {
        if (entityRoleId == null) return;
        updateRole
          .mutateAsync({ entityRoleId, newRoleId })
          .then(() => router.refresh());
      };

      return (
        <Select
          defaultValue={currentRoleId}
          onValueChange={handleRoleChange}
          disabled={isCurrentUser}
        >
          <SelectTrigger className="w-[230px]">
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
          <SelectContent>
            {roles.data?.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>{role.name}</TooltipTrigger>
                    {role.description && (
                      <TooltipContent>
                        <p>{role.description}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    },
  },
  {
    id: "actions",
    header: "Actions",
    accessorKey: "user.id",
    enableGlobalFilter: false,
    cell: ({ row }) => {
      const viewer = api.user.viewer.useQuery();
      const { id } = row.original.entityRole;
      const router = useRouter();
      const remove = api.workspace.iam.remove.useMutation();
      if (id == null) return null;
      return (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <IconDots />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() =>
                  remove.mutateAsync(id).then(() => router.refresh())
                }
                disabled={row.original.user.id === viewer.data?.id}
              >
                Remove from workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

export const MembersTable: React.FC<{
  workspace: Workspace;
  data: Array<Member>;
}> = ({ workspace, data }) => {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnFiltersChange: setColumnFilters,
    state: {
      columnFilters,
      columnVisibility: {
        name: false,
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <div className="flex flex-grow items-center space-x-1">
          <Input
            placeholder="Search by name or email..."
            className="w-72"
            onChange={(e) => table.setGlobalFilter(e.target.value)}
          />
        </div>
        <AddMembersDialog workspace={workspace} />
      </div>
      <Table>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="border-b-neutral-800/50 px-0 hover:bg-transparent"
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
    </div>
  );
};
