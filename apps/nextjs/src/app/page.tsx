import { redirect } from "next/navigation";

import { auth } from "@ctrlplane/auth";

import { api } from "~/trpc/server";

export default async function SystemPage() {
  const session = await auth();
  if (session == null) redirect("/login");
  const workspaces = await api.workspace.list();
  if (workspaces.length === 0) redirect("/workspaces/create");
  redirect(`/${workspaces[0]!.slug}`);
}
