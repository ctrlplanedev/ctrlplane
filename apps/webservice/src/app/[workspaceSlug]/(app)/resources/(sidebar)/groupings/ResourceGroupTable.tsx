"use client";

import type { ResourceMetadataGroup, Workspace } from "@ctrlplane/db/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconDots } from "@tabler/icons-react";

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
import { EditMetadataGroupDialog } from "./EditMetadataGroupDialog";

export const ResourceGroupsTable: React.FC<{
  workspace: Workspace;
  metadataGroups: {
    resources: number;
    resourceMetadataGroup: ResourceMetadataGroup;
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
          <TableHead>Resources</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {metadataGroups.map((metadataGroup) => (
          <TableRow
            key={metadataGroup.resourceMetadataGroup.id}
            className="cursor-pointer border-b-neutral-800/50"
            onClick={() =>
              router.push(
                `/${workspace.slug}/resources/groupings/${metadataGroup.resourceMetadataGroup.id}`,
              )
            }
          >
            <TableCell>{metadataGroup.resourceMetadataGroup.name}</TableCell>
            <TableCell>
              <div className="flex flex-col font-mono text-xs text-red-400">
                {metadataGroup.resourceMetadataGroup.keys.map((key) => (
                  <span key={key}>{key}</span>
                ))}
              </div>
            </TableCell>
            <TableCell>{metadataGroup.resources}</TableCell>
            <TableCell
              className="flex justify-end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu
                open={openDropdownId === metadataGroup.resourceMetadataGroup.id}
                onOpenChange={(open) => {
                  if (open)
                    setOpenDropdownId(metadataGroup.resourceMetadataGroup.id);
                  if (!open) setOpenDropdownId("");
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <IconDots className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <EditMetadataGroupDialog
                    workspaceId={workspace.id}
                    parentClose={() => setOpenDropdownId("")}
                    metadataGroup={metadataGroup.resourceMetadataGroup}
                  >
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      Edit
                    </DropdownMenuItem>
                  </EditMetadataGroupDialog>
                  <DeleteMetadataGroupDialog
                    id={metadataGroup.resourceMetadataGroup.id}
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
