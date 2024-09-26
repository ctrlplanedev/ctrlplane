import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { TargetPageContent } from "./TargetPageContent";

export default async function TargetsPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();
  return <TargetPageContent workspace={workspace} />;
}
