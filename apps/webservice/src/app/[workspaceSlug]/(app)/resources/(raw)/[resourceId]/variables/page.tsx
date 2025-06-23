import Link from "next/link";
import { notFound } from "next/navigation";
import { IconDots, IconLink, IconLock, IconPlus } from "@tabler/icons-react";

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

import { urls } from "~/app/urls";
import { api } from "~/trpc/server";
import { CreateResourceVariableDialog } from "./CreateResourceVariableDialog";
import { ResourceVariableDropdown } from "./ResourceVariableDropdown";

export default async function VariablesPage(props: {
  params: Promise<{ workspaceSlug: string; resourceId: string }>;
}) {
  const { workspaceSlug, resourceId } = await props.params;
  const resource = await api.resource.byId(resourceId);
  if (resource == null) notFound();

  const deploymentVariables =
    await api.deployment.variable.byResourceId(resourceId);

  const { directVariables, referenceVariables, rules } = resource;
  const references = rules.map((r) => r.reference);
  const allVariableKeys = [...directVariables, ...referenceVariables].map(
    (v) => v.key,
  );

  return (
    <div className="max-w-5xl space-y-8 p-8">
      {/* Direct Variables Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2>Direct Variables</h2>
          <CreateResourceVariableDialog
            resourceId={resourceId}
            existingKeys={allVariableKeys}
            references={references}
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
              {directVariables.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    No direct variables found
                  </TableCell>
                </TableRow>
              ) : (
                directVariables.map((v) => (
                  <TableRow key={v.key}>
                    <TableCell className="flex items-center gap-2">
                      <span>{v.key}</span>
                      {v.sensitive && (
                        <IconLock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      {v.sensitive ? (
                        "*****"
                      ) : (
                        <span className="rounded-md p-0.5 px-1 font-mono text-red-400">
                          {typeof v.value === "object"
                            ? JSON.stringify(v.value)
                            : String(v.value)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <ResourceVariableDropdown
                          resourceVariable={v}
                          existingKeys={allVariableKeys}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                          >
                            <IconDots className="h-4 w-4" />
                          </Button>
                        </ResourceVariableDropdown>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Reference Variables Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2>Reference Variables</h2>
        </div>

        <Card className="rounded-md">
          <Table className="w-full">
            <TableHeader className="text-left">
              <TableRow className="text-sm">
                <TableHead>Key</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>From Resource</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Resolved Value</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {referenceVariables.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    No reference variables found
                  </TableCell>
                </TableRow>
              ) : (
                referenceVariables.map((v) => (
                  <TableRow key={v.key}>
                    <TableCell className="flex items-center gap-2">
                      <span>{v.key}</span>
                    </TableCell>
                    <TableCell>{v.reference}</TableCell>
                    <TableCell>
                      {(() => {
                        const relationship =
                          resource.relationships[v.reference];
                        if (!relationship?.target) {
                          return (
                            <span className="text-amber-500">
                              {v.reference} (not found)
                            </span>
                          );
                        }

                        const target = relationship.target;
                        return (
                          <div className="flex items-center gap-2">
                            <Link
                              href={urls
                                .workspace(workspaceSlug)
                                .resource(target.id)
                                .properties()}
                              className="text-blue-500 underline-offset-1 hover:underline"
                            >
                              {target.name || v.reference}
                            </Link>
                            <IconLink className="h-4 w-4 text-muted-foreground" />
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {v.path.join(".")}
                      </span>
                    </TableCell>
                    <TableCell>
                      {v.sensitive ? (
                        "*****"
                      ) : (
                        <span className="rounded-md p-0.5 px-1 font-mono text-blue-400">
                          {typeof v.resolvedValue === "object"
                            ? JSON.stringify(v.resolvedValue)
                            : String(v.resolvedValue)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <ResourceVariableDropdown
                          resourceVariable={v}
                          existingKeys={allVariableKeys}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                          >
                            <IconDots className="h-4 w-4" />
                          </Button>
                        </ResourceVariableDropdown>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Deployment Variables Section */}
      <div className="space-y-4">
        <h2>Deployment Variables</h2>
        <Card className="rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Deployment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deploymentVariables.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    No deployment variables found
                  </TableCell>
                </TableRow>
              ) : (
                deploymentVariables.map((v) => (
                  <TableRow key={v.key}>
                    <TableCell>{v.key}</TableCell>
                    <TableCell></TableCell>
                    <TableCell>
                      <Link
                        href={urls
                          .workspace(workspaceSlug)
                          .system(v.deployment.system.slug)
                          .deployment(v.deployment.slug)
                          .variables()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline-offset-1 hover:underline"
                      >
                        {v.deployment.name}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
