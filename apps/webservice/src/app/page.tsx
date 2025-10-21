import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@ctrlplane/auth";

import { api } from "~/trpc/server";

export default async function SystemPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session == null) redirect("/login");
  const workspaces = await api.workspace.list();
  if (workspaces.length === 0) redirect("/workspaces/create");
  const user = await api.user.viewer();

  if (user.activeWorkspaceId != null) {
    const workspace = await api.workspace.byId(user.activeWorkspaceId);
    if (workspace != null) redirect(`/${workspace.slug}`);
  }

  redirect(`/${workspaces[0]!.slug}`);
}
