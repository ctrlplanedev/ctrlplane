"use client";

import type { User, WorkspaceMember } from "@ctrlplane/db/schema";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { capitalCase } from "change-case";
import { TbCheck, TbChevronDown, TbCopy, TbDots } from "react-icons/tb";
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
import { Table, TableBody, TableCell, TableRow } from "@ctrlplane/ui/table";

import { env } from "~/env";
import { api } from "~/trpc/react";

interface Member {
  user: User;
  workspace_member: WorkspaceMember;
}

const InviteLinkSection: React.FC<{
  sessionMember?: Member;
  workspaceSlug: string;
  inviteLink?: string;
}> = ({ sessionMember, workspaceSlug, inviteLink }) => {
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const utils = api.useUtils();
  const { mutateAsync } = api.invite.workspace.link.create.useMutation({
    onSuccess: () =>
      utils.invite.workspace.link.byWorkspaceMemberId.invalidate(),
  });
  const [clickedCopy, setClickedCopy] = useState(false);

  const [token] = useState(inviteLink ?? v4());
  const link = `${env.NEXT_PUBLIC_BASE_URL}/join/${token}`;

  const handleCopyClick = () => {
    navigator.clipboard.writeText(link).then(() => {
      setClickedCopy(true);
      setTimeout(() => setClickedCopy(false), 1000);
    });

    if (inviteLink == null && workspace.data != null && sessionMember != null)
      mutateAsync({
        workspaceId: workspace.data.id,
        workspaceMemberId: sessionMember.workspace_member.id,
        token,
      });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="font-semibold">Invite link</p>
        <p className="text-sm text-muted-foreground">
          Share this link to invite members to your workspace.
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Input readOnly value={link} className="w-96 overflow-ellipsis" />
        <Button variant="outline" size="icon" onClick={handleCopyClick}>
          {clickedCopy ? <TbCheck className="text-green-600" /> : <TbCopy />}
        </Button>
      </div>
    </div>
  );
};

const AddMembersDialog: React.FC<{
  workspaceSlug: string;
  sessionMember?: Member;
}> = ({ sessionMember, workspaceSlug }) => {
  const [inviteMode, setInviteMode] = useState<"email" | "link">("email");
  const inviteLink = api.invite.workspace.link.byWorkspaceMemberId.useQuery(
    sessionMember?.workspace_member.id ?? "",
    { enabled: sessionMember != null },
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">Add member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to {capitalCase(workspaceSlug)}</DialogTitle>
        </DialogHeader>

        {inviteMode === "link" ? (
          <InviteLinkSection
            sessionMember={sessionMember}
            workspaceSlug={workspaceSlug}
            inviteLink={inviteLink.data?.token}
          />
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
    accessorKey: "workspace_member.role",
    enableGlobalFilter: false,
    cell: "admin",
  },
  {
    id: "actions",
    header: "Actions",
    accessorKey: "user.id",
    enableGlobalFilter: false,
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <TbDots />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export const MembersTable: React.FC<{
  workspaceSlug: string;
  data: Array<Member>;
  sessionMember?: Member;
}> = ({ workspaceSlug, data, sessionMember }) => {
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-1">
                <TbChevronDown />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem>Admins</DropdownMenuItem>
              <DropdownMenuItem>Members</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <AddMembersDialog
          workspaceSlug={workspaceSlug}
          sessionMember={sessionMember}
        />
      </div>
      <Table>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="flex items-center justify-between border-b-neutral-800/50 px-0 hover:bg-transparent"
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
