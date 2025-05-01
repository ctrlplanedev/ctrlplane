"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";
import { IconDots, IconLock, IconPlus } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { api } from "~/trpc/react";
import { CreateResourceVariableDialog } from "./CreateResourceVariableDialog";
import { ResourceVariableDropdown } from "./ResourceVariableDropdown";

const ResourceVariableSection: React.FC<{
  resourceId: string;
  resourceVariables: SCHEMA.ResourceVariable[];
}> = ({ resourceId, resourceVariables }) => {
  const directVariables = resourceVariables.filter(
    (v): v is SCHEMA.DirectResourceVariable => v.valueType === "direct",
  );
  const directVariableKeys = directVariables.map((v) => v.key);

  return (
    <div className="space-y-6 py-1">
      <div className="flex items-center gap-2 text-lg font-semibold">
        Resource Variables
        <CreateResourceVariableDialog
          resourceId={resourceId}
          existingKeys={directVariableKeys}
        >
          <Button variant="outline" size="icon" className="h-8 w-8">
            <IconPlus className="h-4 w-4" />
          </Button>
        </CreateResourceVariableDialog>
      </div>
      <Table className="w-full">
        <TableHeader className="text-left">
          <TableRow className="text-sm">
            <TableHead>Key</TableHead>
            <TableHead>Value</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {resourceVariables.map((v) => (
            <TableRow key={v.key}>
              <TableCell className="flex items-center gap-2">
                <span>{v.key}</span>
                {v.sensitive && (
                  <IconLock className="h-4 w-4 text-muted-foreground" />
                )}
                {v.valueType === "reference" && (
                  <span className="text-xs text-muted-foreground">(ref)</span>
                )}
              </TableCell>
              <TableCell>
                {v.sensitive
                  ? "*****"
                  : v.value != null
                    ? String(v.value)
                    : "<unset>"}
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <ResourceVariableDropdown
                    resourceVariable={v}
                    existingKeys={directVariableKeys}
                  >
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <IconDots className="h-4 w-4" />
                    </Button>
                  </ResourceVariableDropdown>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const VariableRow: React.FC<{
  varKey: string;
  description: string;
  value?: string | null;
  isResourceVar: boolean;
  sensitive: boolean;
}> = ({ varKey, description, value, isResourceVar, sensitive }) => (
  <TableRow>
    <TableCell>
      <div className="flex items-center gap-2">
        <span>{varKey} </span>
        {sensitive && <IconLock className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="text-sm text-muted-foreground">{description}</div>
    </TableCell>
    <TableCell className="flex items-center gap-2">
      {sensitive && <div className="text-muted-foreground">*****</div>}
      {!sensitive &&
        (value ?? <div className="italic text-neutral-500">NULL</div>)}
      {isResourceVar && (
        <div className="text-xs text-muted-foreground">(resource)</div>
      )}
      {!isResourceVar && (
        <div className="text-xs text-muted-foreground">(deployment)</div>
      )}
    </TableCell>
  </TableRow>
);

export const VariableContent: React.FC<{
  resourceId: string;
  resourceVariables: SCHEMA.ResourceVariable[];
}> = ({ resourceId, resourceVariables }) => {
  const deployments = api.deployment.byResourceId.useQuery(resourceId);
  const variables = api.deployment.variable.byResourceId.useQuery(resourceId);

  return (
    <div className="space-y-8 overflow-y-auto">
      <ResourceVariableSection
        resourceId={resourceId}
        resourceVariables={resourceVariables}
      />
      <div className="text-lg font-semibold">Deployment Variables</div>
      {deployments.data
        ?.filter((d) => {
          const vars = variables.data?.filter((v) => v.deploymentId === d.id);
          return vars != null && vars.length > 0;
        })
        .map((deployment) => {
          return (
            <div key={deployment.id} className="space-y-2 border-b">
              <div className="font-semibold">{deployment.name}</div>
              <Table className="w-full table-fixed">
                <TableHeader className="text-left">
                  <TableRow className="text-sm">
                    <TableHead className="p-3">Keys</TableHead>
                    <TableHead className="p-3">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variables.data
                    ?.filter((v) => v.deploymentId === deployment.id)
                    .map((v) => {
                      const resourceVar = resourceVariables.find(
                        (rv) => rv.key === v.key,
                      );
                      const displayValue = resourceVar?.value ?? v.value.value;
                      const displaySensitive = resourceVar?.sensitive ?? false;

                      return (
                        <VariableRow
                          key={v.id}
                          varKey={v.key}
                          value={displayValue as string | null | undefined}
                          description={v.description}
                          isResourceVar={resourceVar != null}
                          sensitive={displaySensitive}
                        />
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          );
        })}
    </div>
  );
};
