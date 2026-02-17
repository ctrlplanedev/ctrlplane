import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { trpc } from "~/api/trpc";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { CopyButton } from "~/components/ui/copy-button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useDeployment } from "../_components/DeploymentProvider";

type Value = WorkspaceEngine["schemas"]["Value"];
type LiteralValue = WorkspaceEngine["schemas"]["LiteralValue"];

function formatValue(value: Value | LiteralValue): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value.toString();

  if (typeof value === "object") {
    if ("object" in value) {
      return JSON.stringify(value.object, null, 2);
    }
    if ("reference" in value) {
      const pathStr = value.path.length > 0 ? `[${value.path.join(".")}]` : "";
      return `reference: ${value.reference}${pathStr}`;
    }
    if ("valueHash" in value) {
      return `[sensitive: ${value.valueHash}]`;
    }
  }

  return JSON.stringify(value, null, 2);
}

function formatSelector(selector?: {
  cel?: string;
  json?: Record<string, unknown>;
}): string {
  if (!selector) return "No selector";
  if ("cel" in selector && selector.cel) return selector.cel;
  if ("json" in selector && selector.json)
    return JSON.stringify(selector.json, null, 2);
  return "No selector";
}

export default function DeploymentsSettingsPage() {
  const { workspace } = useWorkspace();
  const { deployment } = useDeployment();
  const [expandedVariables, setExpandedVariables] = useState<Set<string>>(
    new Set(),
  );

  const { data: variables = [] } = trpc.deployment.variables.useQuery({
    workspaceId: workspace.id,
    deploymentId: deployment.id,
  });

  const toggleVariable = (variableId: string) => {
    setExpandedVariables((prev) => {
      const next = new Set(prev);
      if (next.has(variableId)) {
        next.delete(variableId);
      } else {
        next.add(variableId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">General Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your deployment settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deployment ID</CardTitle>
          <CardDescription>Your deployment's unique identifier</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="deployment-id">ID</Label>
              <Input
                id="deployment-id"
                type="text"
                value={deployment.id}
                readOnly
                className="font-mono"
              />
            </div>
            <CopyButton textToCopy={deployment.id} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deployment Variables</CardTitle>
          <CardDescription>
            Variables and their values for this deployment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {variables.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No variables configured for this deployment.
            </p>
          ) : (
            <div className="space-y-4">
              {variables.map((variableWithValues) => {
                const { variable, values } = variableWithValues;
                const isExpanded = expandedVariables.has(variable.id);
                const sortedValues = [...values].sort(
                  (a, b) => b.priority - a.priority,
                );

                return (
                  <Collapsible
                    key={variable.id}
                    open={isExpanded}
                    onOpenChange={() => toggleVariable(variable.id)}
                  >
                    <div className="rounded-lg border">
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-20 w-full justify-between p-4"
                        >
                          <div className="flex items-start gap-3 text-left">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">
                                  {variable.key}
                                </span>
                                {variable.defaultValue && (
                                  <Badge variant="outline" className="text-xs">
                                    Default:{" "}
                                    {formatValue(variable.defaultValue)}
                                  </Badge>
                                )}
                                {values.length > 0 && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {values.length} value
                                    {values.length !== 1 ? "s" : ""}
                                  </Badge>
                                )}
                              </div>
                              {variable.description && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {variable.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </Button>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="space-y-3 border-t p-4">
                          {sortedValues.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No values configured. Using default value.
                            </p>
                          ) : (
                            sortedValues.map((value) => (
                              <div
                                key={value.id}
                                className="space-y-2 rounded-md border bg-muted/50 p-3"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      Priority: {value.priority}
                                    </Badge>
                                    {value.resourceSelector && (
                                      <Badge
                                        variant="outline"
                                        className="font-mono text-xs"
                                      >
                                        Selector
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                {value.resourceSelector && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">
                                      Resource Selector
                                    </Label>
                                    <pre className="mt-1 rounded-md bg-background p-2 font-mono text-xs">
                                      {formatSelector(value.resourceSelector)}
                                    </pre>
                                  </div>
                                )}

                                <div>
                                  <Label className="text-xs text-muted-foreground">
                                    Value
                                  </Label>
                                  <pre className="mt-1 break-all rounded-md bg-background p-2 font-mono text-xs">
                                    {formatValue(value.value)}
                                  </pre>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
