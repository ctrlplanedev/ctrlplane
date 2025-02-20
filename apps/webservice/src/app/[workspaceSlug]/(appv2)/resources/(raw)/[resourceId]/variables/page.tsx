import { notFound } from "next/navigation";
import { IconDots, IconLock, IconPlus } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { api } from "~/trpc/server";
import { CreateResourceVariableDialog } from "./CreateResourceVariableDialog";
import { ResourceVariableDropdown } from "./ResourceVariableDropdown";

export default async function VariablesPage(props: {
  params: Promise<{ resourceId: string }>;
}) {
  const { resourceId } = await props.params;
  const resource = await api.resource.byId(resourceId);
  if (resource == null) notFound();

  const { variables } = resource;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        Resource Variables
        <CreateResourceVariableDialog
          resourceId={resourceId}
          existingKeys={variables.map((v) => v.key)}
        >
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <IconPlus className="h-4 w-4" />
            Add Variable
          </Button>
        </CreateResourceVariableDialog>
      </div>
      <Card className="rounded-md">
        <Table className="w-full">
          <TableHeader className="text-left">
            <TableRow className="text-sm">
              <TableHead>Key</TableHead>
              <TableHead>Value</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {variables.map((v) => (
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
                    <ResourceVariableDropdown
                      resourceVariable={v}
                      existingKeys={variables.map((v) => v.key)}
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
      </Card>
    </div>
  );
}
