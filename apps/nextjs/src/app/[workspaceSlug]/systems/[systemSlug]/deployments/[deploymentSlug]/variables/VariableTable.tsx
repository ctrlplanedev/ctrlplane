import type {
  DeploymentVariable,
  DeploymentVariableValue,
} from "@ctrlplane/db/schema";
import { Fragment } from "react";
import { TbDotsVertical, TbPlus } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { AddVariableValueDialog } from "../AddVariableValueDialog";

type VariableData = DeploymentVariable & { values: DeploymentVariableValue[] };

export const VariableTable: React.FC<{
  variables: VariableData[];
}> = ({ variables }) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Key</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Scope</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>

      <TableBody>
        {variables.map((variable) => {
          return (
            <Fragment key={variable.id}>
              <TableRow>
                <TableCell rowSpan={variable.values.length + 1}>
                  <div className="flex items-center gap-1">
                    {variable.key}
                    <AddVariableValueDialog variable={variable}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full text-muted-foreground"
                      >
                        <TbPlus />
                      </Button>
                    </AddVariableValueDialog>
                  </div>
                  <div className="text-muted-foreground">
                    {variable.description}
                  </div>
                </TableCell>
              </TableRow>
              {variable.values.map((v, idx) => (
                <TableRow
                  key={v.id}
                  className={
                    idx !== variable.values.length - 1
                      ? "border-b-neutral-900"
                      : ""
                  }
                >
                  <TableCell>
                    <pre>{JSON.stringify(v.value)}</pre>
                  </TableCell>
                  <TableCell className="space-x-2">
                    {/* {v.deployments.map((d) => (
                      <div
                        key={d.id}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-blue-400 hover:bg-blue-500/15"
                      >
                        <TbShip /> {d.name}
                      </div>
                    ))}
                    {v.systems.map((d) => (
                      <div
                        key={d.id}
                        className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-green-400 hover:bg-green-500/15"
                      >
                        <TbCategory /> {d.name}
                      </div>
                    ))} */}
                  </TableCell>
                  <TableCell className="w-10">
                    <Button variant="ghost" size="icon">
                      <TbDotsVertical />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
};
