import { notFound, redirect } from "next/navigation";

import { api } from "~/trpc/server";

export default async function SystemsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();

  const systems = await api.system.list({
    workspaceId: workspace.id,
    limit: 1,
  });
  const [firstSystem] = systems.items;
  if (firstSystem == null) notFound();
  const system = firstSystem;

  return redirect(`/${workspace.slug}/systems/${system.slug}`);
}
