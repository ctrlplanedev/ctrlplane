import { notFound, redirect } from "next/navigation";

import { auth } from "@ctrlplane/auth";
import { SidebarInset } from "@ctrlplane/ui/sidebar";

import { api } from "~/trpc/server";
import { SettingsSidebar } from "./SettingsSidebar";

type Props = {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
};

export default async function AccountSettingsLayout(props: Props) {
  const params = await props.params;

  const { workspaceSlug } = params;

  const { children } = props;

  const session = await auth();
  if (session == null) redirect("/login");

  const workspace = await api.workspace.bySlug(workspaceSlug).catch(() => null);
  if (workspace == null) notFound();

  return (
    <>
      <SettingsSidebar workspace={workspace} />
      <SidebarInset className="pt-10">{children}</SidebarInset>
    </>
  );
}
