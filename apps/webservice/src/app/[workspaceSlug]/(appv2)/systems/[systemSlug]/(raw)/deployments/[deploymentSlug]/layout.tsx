import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";

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
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
} from "@ctrlplane/ui/sidebar";

import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { SidebarLink } from "~/app/[workspaceSlug]/(appv2)/resources/(sidebar)/SidebarLink";
import { api } from "~/trpc/server";

export default async function DeploymentLayout(props: {
  children: React.ReactNode;
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>;
}) {
  const params = await props.params;
  const system = await api.system.bySlug(params).catch(() => null);
  const deployment = await api.deployment.bySlug(params).catch(() => null);
  if (system == null || deployment == null) notFound();

  const url = (tab: string) =>
    `/${params.workspaceSlug}/systems/${params.systemSlug}/deployments/${params.deploymentSlug}/${tab}`;
  return (
    <div>
      <PageHeader className="justify-between">
        <div className="flex shrink-0 items-center gap-4">
          <Link
            href={`/${params.workspaceSlug}/systems/${params.systemSlug}/deployments`}
          >
            <IconArrowLeft className="size-5" />
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink
                  href={`/${params.workspaceSlug}/systems/${params.systemSlug}/deployments`}
                >
                  {system.name}&apos;s Deployments
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{deployment.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </PageHeader>

      <SidebarProvider className="relative">
        <Sidebar className="absolute left-0 top-0">
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                <SidebarLink href={url("resources")}>Properties</SidebarLink>
                <SidebarLink href={url("workflow")}>Workflow</SidebarLink>
                <SidebarLink href={url("releases")}>Releases</SidebarLink>
                <SidebarLink href={url("channels")}>Channels</SidebarLink>
                <SidebarLink href={url("targets")}>Targets</SidebarLink>
                <SidebarLink href={url("variables")}>Variables</SidebarLink>
                <SidebarLink href={url("settings")}>Settings</SidebarLink>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="h-[calc(100vh-56px-1px)]">
          {props.children}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
