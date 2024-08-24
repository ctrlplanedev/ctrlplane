import { notFound, redirect } from "next/navigation";

import { auth } from "@ctrlplane/auth";

import { api } from "~/trpc/server";
import { SidebarPanels } from "./SidebarPanels";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceSlug: string };
}) {
  const session = await auth();
  if (session == null) redirect("/login");

  const workspace = await api.workspace
    .bySlug(params.workspaceSlug)
    .catch(() => null);

  if (workspace == null) notFound();
  return (
    <div className="h-screen">
      <SidebarPanels>{children}</SidebarPanels>
    </div>
  );
}
