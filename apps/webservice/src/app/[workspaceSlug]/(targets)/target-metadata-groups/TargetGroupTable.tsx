"use client";

import type { TargetMetadataGroup, Workspace } from "@ctrlplane/db/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";
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

import { DeleteMetadataGroupDialog } from "./DeleteMetadataGroupDialog";
import { UpsertMetadataGroupDialog } from "./UpsertMetadataGroupDialog";

export const TargetGroupsTable: React.FC<{
  workspace: Workspace;
  metadataGroups: {
    targets: number;
    targetMetadataGroup: TargetMetadataGroup;
  }[];
}> = ({ workspace, metadataGroups }) => {
  const [openDropdownId, setOpenDropdownId] = useState("");
  const router = useRouter();
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
        {metadataGroups.map((metadataGroup) => (
          <TableRow
            key={metadataGroup.targetMetadataGroup.id}
            className="cursor-pointer border-b-neutral-800/50"
            onClick={() =>
              router.push(
                `/${workspace.slug}/target-metadata-groups/${metadataGroup.targetMetadataGroup.id}`,
              )
            }
          >
            <TableCell>{metadataGroup.targetMetadataGroup.name}</TableCell>
            <TableCell>
              <div className="flex flex-col font-mono text-xs text-red-400">
                {metadataGroup.targetMetadataGroup.keys.map((key) => (
                  <span key={key}>{key}</span>
                ))}
              </div>
            </TableCell>
            <TableCell>{metadataGroup.targets}</TableCell>
            <TableCell
              className="flex justify-end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu
                open={openDropdownId === metadataGroup.targetMetadataGroup.id}
                onOpenChange={(open) => {
                  if (open)
                    setOpenDropdownId(metadataGroup.targetMetadataGroup.id);
                  if (!open) setOpenDropdownId("");
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <TbDots className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <UpsertMetadataGroupDialog
                    workspaceId={workspace.id}
                    create={false}
                    parentClose={() => setOpenDropdownId("")}
                    values={{
                      id: metadataGroup.targetMetadataGroup.id,
                      name: metadataGroup.targetMetadataGroup.name,
                      keys: metadataGroup.targetMetadataGroup.keys.map(
                        (key) => ({
                          value: key,
                        }),
                      ),
                      description:
                        metadataGroup.targetMetadataGroup.description,
                    }}
                  >
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      Edit
                    </DropdownMenuItem>
                  </UpsertMetadataGroupDialog>
                  <DeleteMetadataGroupDialog
                    id={metadataGroup.targetMetadataGroup.id}
                  >
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      Delete
                    </DropdownMenuItem>
                  </DeleteMetadataGroupDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
