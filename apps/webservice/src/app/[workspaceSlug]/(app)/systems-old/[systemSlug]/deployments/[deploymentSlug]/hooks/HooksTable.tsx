import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";
import { IconDots } from "@tabler/icons-react";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { HookActionsDropdown } from "./HookActionsDropdown";

type Hook = RouterOutputs["deployment"]["hook"]["list"][number];

type HooksTableProps = {
  hooks: Hook[];
  jobAgents: SCHEMA.JobAgent[];
  workspace: SCHEMA.Workspace;
};

export const HooksTable: React.FC<HooksTableProps> = ({
  hooks,
  jobAgents,
  workspace,
}) => (
  <Table className="table-fixed">
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Event</TableHead>
        <TableHead>Runbooks</TableHead>
        <TableHead />
      </TableRow>
    </TableHeader>
    <TableBody>
      {hooks.map((hook) => (
        <TableRow key={hook.id}>
          <TableCell>{hook.name}</TableCell>
          <TableCell>
            <span className="rounded-md border-x border-y px-1 font-mono text-red-400">
              {hook.action}
            </span>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2 overflow-hidden">
              {hook.runhooks.map((rh) => (
                <Badge
                  key={rh.id}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {rh.runbook.name}
                </Badge>
              ))}
            </div>
          </TableCell>
          <TableCell className="text-right">
            <HookActionsDropdown
              hook={hook}
              jobAgents={jobAgents}
              workspace={workspace}
            >
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <IconDots className="h-4 w-4" />
              </Button>
            </HookActionsDropdown>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);
