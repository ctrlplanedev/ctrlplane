import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { SiArgo, SiGithub } from "@icons-pack/react-simple-icons";
import { PlayIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

type JobAgent = WorkspaceEngine["schemas"]["JobAgent"];

function ConfigSection({ config }: { config: Record<string, unknown> }) {
  const entries = Object.entries(config);
  if (entries.length === 0) return null;

  return (
    <Card className="scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-muted overflow-auto rounded-md bg-accent p-2">
      <CardContent className="space-y-0.5 p-0">
        {entries
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([key, value]) => (
            <div
              key={key}
              className="flex items-start gap-2 font-mono text-xs font-semibold"
            >
              <span className="shrink-0 text-red-600">{key}:</span>
              <pre className="text-green-700">
                {typeof value === "string"
                  ? value
                  : JSON.stringify(value, null, 2)}
              </pre>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "github-app":
      return <SiGithub className="size-4" />;
    case "argo-cd":
      return <SiArgo className="size-4 text-orange-400" />;
    default:
      return <PlayIcon className="size-4" />;
  }
}

export function JobAgentCard({ jobAgent }: { jobAgent: JobAgent }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TypeIcon type={jobAgent.type} />
          {jobAgent.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ConfigSection {...jobAgent} />
      </CardContent>
    </Card>
  );
}
