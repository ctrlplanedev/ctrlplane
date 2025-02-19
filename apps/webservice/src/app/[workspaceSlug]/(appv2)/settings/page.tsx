import { notFound, redirect } from "next/navigation";

import { api } from "~/trpc/server";

export default async function SettingsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();
  return redirect(`/${workspaceSlug}/settings/workspace/overview`);
}
