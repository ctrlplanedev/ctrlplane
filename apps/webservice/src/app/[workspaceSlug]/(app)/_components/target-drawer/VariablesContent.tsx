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
import { CreateTargetVariableDialog } from "./CreateTargetVariableDialog";
import { TargetVariableDropdown } from "./TargetVariableDropdown";

const TargetVariableSection: React.FC<{
  targetId: string;
  targetVariables: SCHEMA.ResourceVariable[];
}> = ({ targetId, targetVariables }) => (
  <div className="space-y-6 py-1">
    <div className="flex items-center gap-2 text-lg font-semibold">
      Target Variables
      <CreateTargetVariableDialog
        targetId={targetId}
        existingKeys={targetVariables.map((v) => v.key)}
      >
        <Button variant="outline" size="icon" className="h-8 w-8">
          <IconPlus className="h-4 w-4" />
        </Button>
      </CreateTargetVariableDialog>
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
        {targetVariables.map((v) => (
          <TableRow key={v.key}>
            <TableCell className="flex items-center gap-2">
              <span>{v.key}</span>
              {v.sensitive && (
                <IconLock className="h-4 w-4 text-muted-foreground" />
              )}
            </TableCell>
            <TableCell>{v.sensitive ? "*****" : String(v.value)}</TableCell>
            <TableCell>
              <div className="flex justify-end">
                <TargetVariableDropdown
                  targetVariable={v}
                  existingKeys={targetVariables.map((v) => v.key)}
                >
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <IconDots className="h-4 w-4" />
                  </Button>
                </TargetVariableDropdown>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

const VariableRow: React.FC<{
  varKey: string;
  description: string;
  value?: string | null;
  isTargetVar: boolean;
  sensitive: boolean;
}> = ({ varKey, description, value, isTargetVar, sensitive }) => (
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
      {isTargetVar && (
        <div className="text-xs text-muted-foreground">(target)</div>
      )}
      {!isTargetVar && (
        <div className="text-xs text-muted-foreground">(deployment)</div>
      )}
    </TableCell>
  </TableRow>
);

export const VariableContent: React.FC<{
  targetId: string;
  targetVariables: SCHEMA.ResourceVariable[];
}> = ({ targetId, targetVariables }) => {
  const resourceId = targetId;
  const deployments = api.deployment.byTargetId.useQuery(resourceId);
  const variables = api.deployment.variable.byTargetId.useQuery(resourceId);
  return (
    <div className="space-y-8 overflow-y-auto">
      <TargetVariableSection
        targetId={targetId}
        targetVariables={targetVariables}
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
                      const targetVar = targetVariables.find(
                        (tv) => tv.key === v.key,
                      );
                      return (
                        <VariableRow
                          key={v.id}
                          varKey={v.key}
                          value={targetVar?.value ?? v.value.value}
                          description={v.description}
                          isTargetVar={targetVar != null}
                          sensitive={targetVar?.sensitive ?? false}
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
