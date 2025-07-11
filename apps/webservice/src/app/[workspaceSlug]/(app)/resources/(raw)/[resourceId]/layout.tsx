import Link from "next/link";
import { notFound } from "next/navigation";
import {
  IconArrowLeft,
  IconEdit,
  IconLock,
  IconRocket,
  IconSettings,
  IconShieldCheck,
  IconTopologyComplex,
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
import { Button } from "@ctrlplane/ui/button";
import { Separator } from "@ctrlplane/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
} from "@ctrlplane/ui/sidebar";

import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { urls } from "~/app/urls";
import { api } from "~/trpc/server";
import { SidebarLink } from "../../(sidebar)/SidebarLink";

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ resourceId: string; workspaceSlug: string }>;
}) {
  const params = await props.params;
  const resource = await api.resource.byId(params.resourceId);
  if (resource == null) notFound();
  const resourcesUrl = urls
    .workspace(params.workspaceSlug)
    .resources()
    .baseUrl();

  const resourcePageUrls = urls
    .workspace(params.workspaceSlug)
    .resource(params.resourceId);

  return (
    <div className="flex h-full flex-col">
      <PageHeader className="justify-between">
        <div className="flex shrink-0 items-center gap-4">
          <Link href={resourcesUrl}>
            <IconArrowLeft className="size-5" />
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href={resourcesUrl}>Resources</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{resource.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline">
            <IconLock className="size-4" /> Lock
          </Button>
          <Button variant="outline">
            <IconEdit className="size-4" /> Edit
          </Button>
        </div>
      </PageHeader>

      <SidebarProvider
        className="relative h-full"
        sidebarNames={[Sidebars.Resource]}
      >
        <Sidebar
          name={Sidebars.Resource}
          className="absolute left-0 top-0 h-full"
        >
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                <SidebarLink
                  href={resourcePageUrls.deployments().baseUrl()}
                  icon={<IconRocket className="size-4" />}
                >
                  Deployments
                </SidebarLink>
                <SidebarLink
                  href={resourcePageUrls.visualize()}
                  icon={<IconTopologyComplex className="size-4" />}
                >
                  Visualize
                </SidebarLink>
                <SidebarLink
                  href={resourcePageUrls.variables()}
                  icon={<IconVariable className="size-4" />}
                >
                  Variables
                </SidebarLink>
                <SidebarLink
                  href={resourcePageUrls.properties()}
                  icon={<IconSettings className="size-4" />}
                >
                  Properties
                </SidebarLink>
                <SidebarLink
                  href={resourcePageUrls.policies()}
                  icon={<IconShieldCheck className="size-4" />}
                >
                  Policies
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="h-[calc(100vh-56px-64px-2px)] min-w-0 overflow-auto">
          {props.children}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
