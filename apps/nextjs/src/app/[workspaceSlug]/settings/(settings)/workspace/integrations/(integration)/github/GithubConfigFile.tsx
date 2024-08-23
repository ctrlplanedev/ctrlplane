import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import { Separator } from "@ctrlplane/ui/separator";

import { api } from "~/trpc/react";

export const GithubConfigFileSync: React.FC<{
  workspaceId?: string;
}> = ({ workspaceId }) => {
  const configFiles = api.github.configFile.list.useQuery(workspaceId ?? "", {
    enabled: workspaceId != null,
  });

  return (
    <Card className="rounded-md">
      <CardHeader className="space-y-2">
        <CardTitle>Sync Github Config File</CardTitle>
        <CardDescription>
          A{" "}
          <code className="rounded-md bg-neutral-800 p-1">ctrlplane.yaml</code>{" "}
          configuration file allows you to manage your Ctrlplane resources from
          github.
        </CardDescription>
      </CardHeader>

      <Separator />

      <CardContent className="p-4">
        {configFiles.data?.map((configFile) => (
          <div key={configFile.id}>{configFile.name}</div>
        ))}
      </CardContent>
    </Card>
  );
};
