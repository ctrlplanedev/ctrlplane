"use client";

import type * as schema from "@ctrlplane/db/schema";
import { useRouter } from "next/navigation";
import { IconDotsVertical } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { ResourceConditionBadge } from "~/app/[workspaceSlug]/(app)/_components/resource-condition/ResourceConditionBadge";
import { ResourceViewActionsDropdown } from "~/app/[workspaceSlug]/(app)/_components/resource-condition/ResourceViewActionsDropdown";

export const ResourceViewsTable: React.FC<{
  workspace: schema.Workspace;
  views: (schema.ResourceView & { total: number; hash: string })[];
}> = ({ views, workspace }) => {
  const router = useRouter();

  return (
    <Table className="w-full table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Filter</TableHead>
          <TableHead>Total</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {views.map((view) => (
          <TableRow
            key={view.id}
            onClick={() =>
              router.push(
                `/${workspace.slug}/resources?filter=${view.hash}&view=${view.id}`,
              )
            }
            className="cursor-pointer"
          >
            <TableCell>{view.name}</TableCell>
            <TableCell>
              <div className="w-fit">
                <ResourceConditionBadge condition={view.filter} />
              </div>
            </TableCell>
            <TableCell>{view.total}</TableCell>
            <TableCell className="flex justify-end">
              <ResourceViewActionsDropdown view={view}>
                <Button variant="ghost" size="icon">
                  <IconDotsVertical className="h-4 w-4" />
                </Button>
              </ResourceViewActionsDropdown>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
