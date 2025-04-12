import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { ResourcesPageContent } from "./ResourcesPageContent";

export default async function ResourcesPage(props: {
  params: Promise<{ workspaceSlug: string; environmentId: string }>;
}) {
  const { environmentId, workspaceSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();
  const environment = await api.environment.byId(environmentId);
  if (environment == null) return notFound();

  return (
    <ResourcesPageContent
      environment={environment}
      workspaceId={workspace.id}
    />
  );
}
