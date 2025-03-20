import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";

import { api } from "~/trpc/server";
import { ResourcesPageContent } from "./ResourcesPageContent";

export default async function ResourcesPage(props: {
  params: Promise<{ workspaceSlug: string; environmentId: string }>;
}) {
  const { workspaceSlug, environmentId } = await props.params;

  const [workspace, environment] = await Promise.all([
    api.workspace.bySlug(workspaceSlug),
    api.environment.byId(environmentId),
  ]);

  if (workspace == null || environment == null) return notFound();
  const { resourceFilter: resourceSelector } = environment;
  if (resourceSelector == null)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resources</CardTitle>
          <CardDescription>
            Resources managed in this environment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>No resource filter set for this environment</p>
        </CardContent>
      </Card>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resources</CardTitle>
        <CardDescription>Resources managed in this environment</CardDescription>
      </CardHeader>
      <CardContent>
        <ResourcesPageContent
          id={environment.id}
          resourceSelector={resourceSelector}
          workspaceId={workspace.id}
        />
      </CardContent>
    </Card>
  );
}
