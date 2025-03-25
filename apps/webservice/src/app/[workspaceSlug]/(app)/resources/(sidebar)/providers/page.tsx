import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { ProviderPageContent } from "./ProvidersPageContent";

export default async function ResourceProvidersPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();

  return <ProviderPageContent workspace={workspace} />;
}
