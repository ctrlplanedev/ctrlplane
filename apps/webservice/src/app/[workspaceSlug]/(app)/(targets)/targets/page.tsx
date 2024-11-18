import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { TargetPageContent } from "./TargetPageContent";

export const metadata: Metadata = {
  title: "Targets | Ctrlplane",
};

export default async function TargetsPage({
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

  return <TargetPageContent workspace={workspace} view={view} />;
}
