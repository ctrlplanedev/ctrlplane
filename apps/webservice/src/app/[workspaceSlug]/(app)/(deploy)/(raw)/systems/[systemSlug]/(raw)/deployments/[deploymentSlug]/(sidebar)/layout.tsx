import Link from "next/link";
import { notFound } from "next/navigation";
import {
  IconArrowLeft,
  IconPlayerPlay,
  IconSettings,
  IconShip,
  IconTimelineEvent,
  IconVariable,
} from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ctrlplane/ui/breadcrumb";
import { Separator } from "@ctrlplane/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
} from "@ctrlplane/ui/sidebar";

import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { SidebarLink } from "~/app/[workspaceSlug]/(app)/resources/(sidebar)/SidebarLink";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { urls } from "~/app/urls";
import { api } from "~/trpc/server";
import { DeploymentCTA } from "./_components/DeploymentCTA";

export default async function DeploymentLayout(props: {
  children: React.ReactNode;
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>;
}) {
  const params = await props.params;
  const [workspace, system, deployment] = await Promise.all([
    api.workspace.bySlug(params.workspaceSlug),
    api.system.bySlug(params).catch(notFound),
    api.deployment.bySlug(params),
  ]);
  if (workspace == null || deployment == null) notFound();

  const jobAgents = await api.job.agent.byWorkspaceId(workspace.id);

  const systemUrls = urls
    .workspace(params.workspaceSlug)
    .system(params.systemSlug);

  const deploymentUrl = systemUrls.deployment(params.deploymentSlug);

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader className="justify-between">
        <div className="flex shrink-0 items-center gap-4">
          <Link href={systemUrls.deployments()}>
            <IconArrowLeft className="size-5" />
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  href={urls
                    .workspace(params.workspaceSlug)
                    .system(params.systemSlug)
                    .deployments()}
                >
                  Deployments
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{deployment.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <DeploymentCTA
          deploymentId={deployment.id}
          systemId={system.id}
          jobAgents={jobAgents}
          workspace={workspace}
        />
      </PageHeader>
      <SidebarProvider
        className="relative h-full"
        sidebarNames={[Sidebars.Deployment]}
      >
        <Sidebar
          className="absolute left-0 top-0 h-full"
          name={Sidebars.Deployment}
        >
          <SidebarHeader className="rounded-tl-lg p-4">
            <div className="max-w-60 truncate">{deployment.name}</div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Release Management</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarLink
                  icon={<IconShip />}
                  href={deploymentUrl.deployments()}
                  exact
                >
                  Versions
                </SidebarLink>
                <SidebarLink
                  icon={<IconVariable />}
                  href={deploymentUrl.variables()}
                >
                  Variables
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Configuration</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarLink
                  icon={<IconPlayerPlay />}
                  href={deploymentUrl.workflow()}
                >
                  Workflow
                </SidebarLink>

                <SidebarLink
                  icon={<IconTimelineEvent />}
                  href={deploymentUrl.hooks()}
                >
                  Hooks
                </SidebarLink>
              </SidebarMenu>

              <SidebarMenu>
                <SidebarLink
                  icon={<IconSettings />}
                  href={deploymentUrl.properties()}
                >
                  Settings
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-[calc(100vh-56px-64px-2px)] w-[calc(100%-255px-1px)] flex-1 overflow-y-auto">
          {props.children}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
