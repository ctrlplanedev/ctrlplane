import { notFound, redirect } from "next/navigation";

import { urls } from "~/app/urls";
import { api } from "~/trpc/server";

export default async function SettingsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();
  const overviewUrl = urls.workspace(workspaceSlug).settings().baseUrl();
  return redirect(overviewUrl);
}
