import { notFound, redirect } from "next/navigation";

import { api } from "~/trpc/server";

export default async function SystemsPage(props: {
  params: Promise<{ workspaceSlug: string; systemSlug: string }>;
}) {
  const { workspaceSlug, systemSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();

  return redirect(`/${workspaceSlug}/systems/${systemSlug}/deployments`);
}
