import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";

function Value({ value }: { value: WorkspaceEngine["schemas"]["Value"] }) {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return (
      <div className="flex items-start gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          Value:
        </span>
        <span className="font-mono text-sm text-green-700">{value}</span>
      </div>
    );
  if (typeof value === "object" && "path" in value && "reference" in value)
    return (
      <div className="flex items-start gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          Reference:
        </span>
        <span className="font-mono text-sm text-blue-600">
          {value.reference}.{value.path.join(".")}
        </span>
      </div>
    );
  if (typeof value === "object")
    return (
      <div className="flex items-start gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          Value:
        </span>
        <pre className="font-mono text-xs text-green-700">
          {JSON.stringify(value, null, 2)}
        </pre>
      </div>
    );
  return null;
}

export function ValueSection({
  variableValue,
}: {
  variableValue: WorkspaceEngine["schemas"]["DeploymentVariableValue"];
}) {
  const { value, resourceSelector } = variableValue;

  return (
    <div className="space-y-2 rounded-lg border bg-muted/50 p-4">
      <Value value={value} />
      <div className="flex items-start gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          Priority:
        </span>
        <span className="font-mono text-sm ">{variableValue.priority}</span>
      </div>
      <div className="flex items-start gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          Resource Selector:
        </span>
        <span className="font-mono text-sm ">
          {resourceSelector == null
            ? "None"
            : "cel" in resourceSelector
              ? resourceSelector.cel
              : JSON.stringify(resourceSelector.json)}
        </span>
      </div>
    </div>
  );
}

export function DeploymentVariableSection({
  variable,
}: {
  variable: WorkspaceEngine["schemas"]["DeploymentVariableWithValues"];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform",
                  open ? "rotate-90" : "",
                )}
              />
            </Button>
          </CollapsibleTrigger>
          <span className="text-sm font-medium">
            {variable.variable.key} ({variable.values.length})
          </span>
        </div>

        <CollapsibleContent>
          <div className="space-y-4">
            {variable.values.map((value) => (
              <ValueSection key={value.id} variableValue={value} />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
