import dynamic from "next/dynamic";
import { notFound, redirect } from "next/navigation";

import { auth } from "@ctrlplane/auth";
import { SidebarInset, SidebarProvider } from "@ctrlplane/ui/sidebar";

import { api } from "~/trpc/server";
import { EnvironmentDrawer } from "./_components/environment-drawer/EnvironmentDrawer";
import { EnvironmentPolicyDrawer } from "./_components/environment-policy-drawer/EnvironmentPolicyDrawer";
import { JobDrawer } from "./_components/job-drawer/JobDrawer";
import { ReleaseChannelDrawer } from "./_components/release-channel-drawer/ReleaseChannelDrawer";
import { ReleaseDrawer } from "./_components/release-drawer/ReleaseDrawer";
import { TargetDrawer } from "./_components/target-drawer/TargetDrawer";
import { TerminalSessionsProvider } from "./_components/terminal/TerminalSessionsProvider";
import { VariableSetDrawer } from "./_components/variable-set-drawer/VariableSetDrawer";
import { AppSidebar } from "./AppSidebar";
import { AppSidebarPopoverProvider } from "./AppSidebarPopoverContext";

const TerminalDrawer = dynamic(
  () => import("./_components/terminal/TerminalSessionsDrawer"),
  { ssr: false },
);

type Props = {
  children: React.ReactNode;
  params: { workspaceSlug: string };
};

export default async function WorkspaceLayout({
  children,
  params: { workspaceSlug },
}: Props) {
  const session = await auth();
  if (session == null) redirect("/login");

  const workspace = await api.workspace.bySlug(workspaceSlug).catch(() => null);
  if (workspace == null) notFound();

  return (
    <AppSidebarPopoverProvider>
      <TerminalSessionsProvider>
        <SidebarProvider>
          <AppSidebar workspace={workspace} />
          <SidebarInset>{children}</SidebarInset>

          <TargetDrawer />
          <ReleaseDrawer />
          <ReleaseChannelDrawer />
          <EnvironmentDrawer />
          <EnvironmentPolicyDrawer />
          <VariableSetDrawer />
          <JobDrawer />

          <TerminalDrawer />
        </SidebarProvider>
      </TerminalSessionsProvider>
    </AppSidebarPopoverProvider>
  );
}
