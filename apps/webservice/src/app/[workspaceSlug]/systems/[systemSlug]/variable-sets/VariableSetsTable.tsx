"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";

import { Badge } from "@ctrlplane/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { useVariableSetDrawer } from "~/app/[workspaceSlug]/_components/variable-set-drawer/useVariableSetDrawer";

type Assignment = SCHEMA.VariableSetAssignment & {
  environment: SCHEMA.Environment;
};

type VariableSet = SCHEMA.VariableSet & {
  values: SCHEMA.VariableSetValue[];
  assignments: Assignment[];
};

export const VariableSetsTable: React.FC<{
  variableSets: VariableSet[];
}> = ({ variableSets }) => {
  const { setVariableSetId } = useVariableSetDrawer();

  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Values</TableHead>
          <TableHead>Environments</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {variableSets.map((variableSet) => (
          <TableRow
            key={variableSet.id}
            onClick={() => setVariableSetId(variableSet.id)}
            className="cursor-pointer"
          >
            <TableCell>{variableSet.name}</TableCell>
            <TableCell>{variableSet.values.length}</TableCell>
            <TableCell>
              <div className="flex gap-1 overflow-x-auto">
                {variableSet.assignments.map((assignment) => (
                  <Badge
                    key={assignment.id}
                    className="flex-shrink-0"
                    variant="secondary"
                  >
                    {assignment.environment.name}
                  </Badge>
                ))}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
