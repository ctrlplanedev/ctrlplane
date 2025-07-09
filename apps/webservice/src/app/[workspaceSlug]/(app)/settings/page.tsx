import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { urls } from "~/app/urls";
import { api } from "~/trpc/server";

export const metadata: Metadata = {
  title: "Settings | Ctrlplane",
  description: "Configure your account and workspace settings in Ctrlplane.",
};

export default async function SettingsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();
  const overviewUrl = urls
    .workspace(workspaceSlug)
    .workspaceSettings()
    .overview();
  return redirect(overviewUrl);
}
