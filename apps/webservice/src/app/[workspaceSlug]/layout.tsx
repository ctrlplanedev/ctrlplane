import { notFound, redirect } from "next/navigation";

import { auth } from "@ctrlplane/auth";

import { api } from "~/trpc/server";
import { EnvironmentDrawer } from "./_components/environment-drawer/EnvironmentDrawer";
import { EnvironmentPolicyDrawer } from "./_components/environment-policy-drawer/EnvironmentPolicyDrawer";
import { JobDrawer } from "./_components/job-drawer/JobDrawer";
import { ReleaseChannelDrawer } from "./_components/release-channel-drawer/ReleaseChannelDrawer";
import { ReleaseDrawer } from "./_components/release-drawer/ReleaseDrawer";
import { TargetDrawer } from "./_components/target-drawer/TargetDrawer";
import { VariableSetDrawer } from "./_components/variable-set-drawer/VariableSetDrawer";
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

  const systems = await api.system.list({ workspaceId: workspace.id });
  return (
    <>
      <div className="h-screen">
        <SidebarPanels workspace={workspace} systems={systems.items}>
          {children}
        </SidebarPanels>
      </div>
      <TargetDrawer />
      <ReleaseDrawer />
      <ReleaseChannelDrawer />
      <EnvironmentDrawer />
      <EnvironmentPolicyDrawer />
      <VariableSetDrawer />
      <JobDrawer />
    </>
  );
}
