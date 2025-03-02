import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { SystemsPageContent } from "./SystemsPageContent";

export default async function SystemsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();

  return <SystemsPageContent workspace={workspace} />;
}
