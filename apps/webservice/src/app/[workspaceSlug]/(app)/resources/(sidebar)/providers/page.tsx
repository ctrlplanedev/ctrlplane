import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { ProviderPageContent } from "./ProvidersPageContent";
import { ResourceProvidersGettingStarted } from "./ResourceProvidersGettingStarted";

export default async function ResourceProvidersPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();
  const resourceCount =
    await api.resource.provider.page.list.byWorkspaceId.count({
      workspaceId: workspace.id,
    });

  if (resourceCount == 0) return <ResourceProvidersGettingStarted />;
  return <ProviderPageContent workspace={workspace} />;
}
