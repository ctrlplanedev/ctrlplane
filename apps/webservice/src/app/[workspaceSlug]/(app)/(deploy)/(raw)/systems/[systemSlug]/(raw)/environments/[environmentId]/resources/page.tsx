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
  const { environmentId } = await props.params;
  const environment = await api.environment.byId(environmentId);
  if (environment == null) return notFound();

  const { resourceFilter } = environment;
  if (resourceFilter == null)
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
        <ResourcesPageContent environment={environment} />
      </CardContent>
    </Card>
  );
}
