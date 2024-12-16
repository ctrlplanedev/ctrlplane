import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { ResourcePageContent } from "./ResourcePageContent";

export const metadata: Metadata = {
  title: "Resources | Ctrlplane",
};

export default async function ResourcesPage({
  params,
  searchParams,
}: {
  params: { workspaceSlug: string };
  searchParams: { view?: string };
}) {
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();

  const view =
    searchParams.view != null
      ? await api.resource.view.byId(searchParams.view)
      : null;

  return <ResourcePageContent workspace={workspace} view={view} />;
}
