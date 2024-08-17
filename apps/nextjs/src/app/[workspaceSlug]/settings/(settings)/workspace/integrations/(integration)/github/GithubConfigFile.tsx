import { Badge } from "@ctrlplane/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import { Separator } from "@ctrlplane/ui/separator";

import { api } from "~/trpc/react";

export const GithubConfigFileSync: React.FC<{
  workspaceSlug?: string;
  workspaceId?: string;
  loading: boolean;
}> = ({ workspaceSlug, workspaceId, loading }) => {
  const githubOrgs = api.github.organizations.byWorkspaceId.useQuery(
    workspaceId ?? "",
    { enabled: workspaceId != null },
  );

  console.log({ githubOrgs });

  return (
    <Card className="rounded-md">
      <CardHeader className="space-y-2">
        <CardTitle>Sync Github Config File</CardTitle>
        <CardDescription>
          A{" "}
          <code className="rounded-md bg-neutral-800 p-1">ctrlplane.yaml</code>{" "}
          configuration file allows you to manage your Ctrlplane resources from
          a single source of truth.
        </CardDescription>
      </CardHeader>

      <Separator />
    </Card>
  );
};
