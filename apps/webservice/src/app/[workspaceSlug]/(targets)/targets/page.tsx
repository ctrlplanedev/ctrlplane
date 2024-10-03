import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { TargetPageContent } from "./TargetPageContent";

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
      ? await api.target.view.byId(searchParams.view)
      : null;

  return <TargetPageContent workspace={workspace} view={view} />;
}
