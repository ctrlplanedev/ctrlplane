import { notFound, redirect } from "next/navigation";

import { auth } from "@ctrlplane/auth";
import { SidebarInset } from "@ctrlplane/ui/sidebar";

import { api } from "~/trpc/server";
import { DeploymentResourceDrawer } from "./_components/deployment-resource-drawer/DeploymentResourceDrawer";
import { EnvironmentDrawer } from "./_components/environment-drawer/EnvironmentDrawer";
import { EnvironmentPolicyDrawer } from "./_components/environment-policy-drawer/EnvironmentPolicyDrawer";
import { JobDrawer } from "./_components/job-drawer/JobDrawer";
import { ReleaseChannelDrawer } from "./_components/release-channel-drawer/ReleaseChannelDrawer";
import { ReleaseDrawer } from "./_components/release-drawer/ReleaseDrawer";
import { ResourceDrawer } from "./_components/resource-drawer/ResourceDrawer";
import { VariableSetDrawer } from "./_components/variable-set-drawer/VariableSetDrawer";
import { AppSidebar } from "./AppSidebar";
import { AppSidebarPopoverProvider } from "./AppSidebarPopoverContext";
import TerminalDrawer from "./TerminalSessionsDrawer";

type Props = {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
};

export default async function WorkspaceLayout(props: Props) {
  const params = await props.params;

  const { workspaceSlug } = params;

  const { children } = props;

  const session = await auth();
  if (session == null) redirect("/login");

  const workspace = await api.workspace.bySlug(workspaceSlug).catch(() => null);
  if (workspace == null) notFound();

  return (
    <AppSidebarPopoverProvider>
      <AppSidebar workspace={workspace} />
      <SidebarInset>{children}</SidebarInset>

      <ResourceDrawer />
      <ReleaseDrawer />
      <ReleaseChannelDrawer />
      <EnvironmentDrawer />
      <EnvironmentPolicyDrawer />
      <VariableSetDrawer />
      <JobDrawer />
      <DeploymentResourceDrawer />
      <TerminalDrawer />
    </AppSidebarPopoverProvider>
  );
}
