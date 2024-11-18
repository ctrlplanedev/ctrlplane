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

import { TargetConditionBadge } from "~/app/[workspaceSlug]/_components/target-condition/TargetConditionBadge";
import { TargetViewActionsDropdown } from "~/app/[workspaceSlug]/_components/target-condition/TargetViewActionsDropdown";

export const TargetViewsTable: React.FC<{
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
                `/${workspace.slug}/targets?filter=${view.hash}&view=${view.id}`,
              )
            }
            className="cursor-pointer"
          >
            <TableCell>{view.name}</TableCell>
            <TableCell>
              <div className="w-fit">
                <TargetConditionBadge condition={view.filter} />
              </div>
            </TableCell>
            <TableCell>{view.total}</TableCell>
            <TableCell className="flex justify-end">
              <TargetViewActionsDropdown view={view}>
                <Button variant="ghost" size="icon">
                  <IconDotsVertical className="h-4 w-4" />
                </Button>
              </TargetViewActionsDropdown>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
