import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

import { trpc } from "~/api/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useResource } from "./ResourceProvider";

function useVariables() {
  const { workspace } = useWorkspace();
  const { resource } = useResource();
  const { identifier } = resource;

  const { data: variables, isLoading } = trpc.resource.variables.useQuery({
    workspaceId: workspace.id,
    resourceIdentifier: identifier,
  });

  return { variables: variables?.items ?? [], isLoading };
}

function Value({ value }: { value: WorkspaceEngine["schemas"]["Value"] }) {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return <span className="text-green-700">{value}</span>;
  if (typeof value === "object")
    return (
      <pre className="text-green-700">{JSON.stringify(value, null, 2)}</pre>
    );
  if ("valueHash" in value)
    return <span className="text-green-700">*****</span>;
  return null;
}

export function ResourceVariables() {
  const { variables } = useVariables();

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Variables</CardTitle>
      </CardHeader>

      <CardContent>
        {variables.length === 0 && (
          <p className="text-sm text-muted-foreground">No variables</p>
        )}
        {variables.length > 0 &&
          variables
            .sort((a, b) => a.key.localeCompare(b.key))
            .map(({ key, value }) => (
              <div
                key={key}
                className="flex items-start gap-2 font-mono text-xs font-semibold"
              >
                <span className="shrink-0 text-red-600">{key}:</span>
                <Value value={value} />
              </div>
            ))}
      </CardContent>
    </Card>
  );
}
