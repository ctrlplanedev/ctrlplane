"use client";

import type { TargetLabelGroup, Workspace } from "@ctrlplane/db/schema";
import { useState } from "react";
import Link from "next/link";
import { TbDots } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { DeleteLabelGroupDialog } from "./DeleteLabelGroupDialog";
import { UpsertLabelGroupDialog } from "./UpsertLabelGroupDialog";

export const TargetGroupsTable: React.FC<{
  workspace: Workspace;
  labelGroups: { targets: number; targetLabelGroup: TargetLabelGroup }[];
}> = ({ workspace, labelGroups }) => {
  const [openDropdownId, setOpenDropdownId] = useState("");
  return (
    <Table className="w-full">
      <TableHeader>
        <TableRow>
          <TableHead>Group</TableHead>
          <TableHead>Keys</TableHead>
          <TableHead>Targets</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {labelGroups.map((labelGroup) => (
          <TableRow
            key={labelGroup.targetLabelGroup.id}
            className="cursor-pointer border-b-neutral-800/50"
          >
            <TableCell>{labelGroup.targetLabelGroup.name}</TableCell>
            <TableCell>
              <Link
                href={`/${workspace.slug}/target-label-groups/${labelGroup.targetLabelGroup.id}`}
              >
                <div className="flex flex-col font-mono text-xs text-red-400">
                  {labelGroup.targetLabelGroup.keys.map((key) => (
                    <span key={key}>{key}</span>
                  ))}
                </div>
              </Link>
            </TableCell>
            <TableCell>{labelGroup.targets}</TableCell>
            <TableCell className="flex justify-end">
              <DropdownMenu
                open={openDropdownId === labelGroup.targetLabelGroup.id}
                onOpenChange={(open) => {
                  if (open) setOpenDropdownId(labelGroup.targetLabelGroup.id);
                  if (!open) setOpenDropdownId("");
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <TbDots className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <UpsertLabelGroupDialog
                    workspaceId={workspace.id}
                    create={false}
                    parentClose={() => setOpenDropdownId("")}
                    values={{
                      id: labelGroup.targetLabelGroup.id,
                      name: labelGroup.targetLabelGroup.name,
                      keys: labelGroup.targetLabelGroup.keys.map((key) => ({
                        value: key,
                      })),
                      description: labelGroup.targetLabelGroup.description,
                    }}
                  >
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      Edit
                    </DropdownMenuItem>
                  </UpsertLabelGroupDialog>
                  <DeleteLabelGroupDialog id={labelGroup.targetLabelGroup.id}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      Delete
                    </DropdownMenuItem>
                  </DeleteLabelGroupDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
