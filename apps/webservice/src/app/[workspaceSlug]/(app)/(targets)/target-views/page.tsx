import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LZString from "lz-string";

import { api } from "~/trpc/server";
import { TargetViewsTable } from "./TargetViewsTable";

export const metadata: Metadata = {
  title: "Target Views | Ctrlplane",
};

export default async function TargetViewsPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (!workspace) return notFound();

  const views = await api.resource.view.list(workspace.id);
  const viewsWithHash = views.map((view) => ({
    ...view,
    hash: LZString.compressToEncodedURIComponent(JSON.stringify(view.filter)),
  }));

  return <TargetViewsTable workspace={workspace} views={viewsWithHash} />;
}
