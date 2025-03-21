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
  const workspace = await api.workspace.bySlug(workspaceSlug);
  const environment = await api.environment.byId(environmentId);
  if (workspace == null || environment == null) return notFound();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resources</CardTitle>
        <CardDescription>Resources managed in this environment</CardDescription>
      </CardHeader>
      <CardContent>
        <ResourcesPageContent
          workspaceId={workspace.id}
          environment={environment}
        />
      </CardContent>
    </Card>
  );
}
