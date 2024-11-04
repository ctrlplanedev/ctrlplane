"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import { IconDotsVertical } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@ctrlplane/ui/table";

import { LifecycleHookActionsDropdown } from "./LifecycleHookActionsDropdown";

type LifecycleHook = SCHEMA.DeploymentLifecycleHook & {
  runbook: SCHEMA.Runbook;
};

type LifecycleHooksTableProps = {
  deploymentId: string;
  lifecycleHooks: LifecycleHook[];
};

export const LifecycleHooksTable: React.FC<LifecycleHooksTableProps> = ({
  lifecycleHooks,
}) => {
  return (
    <Table>
      <TableBody>
        {lifecycleHooks.map((lifecycleHook) => (
          <TableRow key={lifecycleHook.id}>
            <TableCell>{lifecycleHook.runbook.name}</TableCell>
            <TableCell>
              <div className="flex justify-end">
                <LifecycleHookActionsDropdown lifecycleHook={lifecycleHook}>
                  <Button size="icon" variant="ghost" className="h-6 w-6">
                    <IconDotsVertical size="icon" className="h-4 w-4" />
                  </Button>
                </LifecycleHookActionsDropdown>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
