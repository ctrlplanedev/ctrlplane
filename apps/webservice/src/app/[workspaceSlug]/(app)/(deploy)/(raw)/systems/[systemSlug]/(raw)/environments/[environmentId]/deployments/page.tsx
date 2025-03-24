import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";

import { api } from "~/trpc/server";
import { EnvironmentDeploymentsPageContent } from "./EnvironmentDeploymentsPageContent";

export default async function DeploymentsPage(props: {
  params: Promise<{ environmentId: string; workspaceSlug: string }>;
}) {
  const { environmentId, workspaceSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployments</CardTitle>
        <CardDescription>View detailed deployment information</CardDescription>
      </CardHeader>
      <CardContent>
        <EnvironmentDeploymentsPageContent
          environmentId={environmentId}
          workspaceId={workspace.id}
        />
      </CardContent>
    </Card>
  );
}
