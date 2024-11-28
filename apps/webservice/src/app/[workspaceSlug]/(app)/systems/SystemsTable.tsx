"use client";

import type { Environment, System } from "@ctrlplane/db/schema";
import { useRouter } from "next/navigation";
import { IconDotsVertical } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@ctrlplane/ui/table";

import { SystemActionsDropdown } from "./SystemActionsDropdown";

export const SystemsTable: React.FC<{
  systems: (System & { environments: Environment[] })[];
  workspaceSlug: string;
}> = ({ systems, workspaceSlug }) => {
  const router = useRouter();
  return (
    <Table className="table-fixed">
      <TableBody>
        {systems.map((system) => (
          <TableRow
            className="cursor-pointer border-b-neutral-800/50"
            key={system.id}
          >
            <TableCell
              onClick={() =>
                router.push(
                  `/${workspaceSlug}/systems/${system.slug}/deployments`,
                )
              }
            >
              {system.name}
            </TableCell>
            <TableCell>
              <div className="flex justify-end">
                <SystemActionsDropdown system={system}>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <IconDotsVertical className="h-3 w-3" />
                  </Button>
                </SystemActionsDropdown>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
