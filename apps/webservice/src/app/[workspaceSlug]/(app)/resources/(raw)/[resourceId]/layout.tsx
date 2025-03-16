import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft, IconEdit, IconLock } from "@tabler/icons-react";

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
import { api } from "~/trpc/server";
import { SidebarLink } from "../../(sidebar)/SidebarLink";

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ resourceId: string; workspaceSlug: string }>;
}) {
  const params = await props.params;
  const resource = await api.resource.byId(params.resourceId);
  if (resource == null) notFound();
  return (
    <div className="flex h-full flex-col">
      <PageHeader className="justify-between">
        <div className="flex shrink-0 items-center gap-4">
          <Link href={`/${params.workspaceSlug}/resources`}>
            <IconArrowLeft className="size-5" />
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href={`/${params.workspaceSlug}/resources`}>
                  Resources
                </BreadcrumbLink>
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
                  href={`/${params.workspaceSlug}/resources/${params.resourceId}/deployments`}
                >
                  Deployments
                </SidebarLink>
                <SidebarLink
                  href={`/${params.workspaceSlug}/resources/${params.resourceId}/visualize`}
                >
                  Visualize
                </SidebarLink>
                <SidebarLink
                  href={`/${params.workspaceSlug}/resources/${params.resourceId}/variables`}
                >
                  Variables
                </SidebarLink>
                <SidebarLink
                  href={`/${params.workspaceSlug}/resources/${params.resourceId}/properties`}
                >
                  Properties
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
