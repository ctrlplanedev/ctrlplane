import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft, IconEdit, IconLock } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Button } from "@ctrlplane/ui/button";
import { Separator } from "@ctrlplane/ui/separator";

import { api } from "~/trpc/server";
import { TabLink, Tabs, TabsList } from "../../_components/navigation/Tabs";
import { PageHeader } from "../../_components/PageHeader";

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ resourceId: string; workspaceSlug: string }>;
}) {
  const params = await props.params;
  const resource = await api.resource.byId(params.resourceId);
  if (resource == null) notFound();
  return (
    <div>
      <PageHeader className="justify-between">
        <div className="flex shrink-0 items-center gap-4">
          <Link href={`/${params.workspaceSlug}/resources`}>
            <IconArrowLeft className="size-5" />
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbPage>Resource List</BreadcrumbPage>
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

      <div className="mx-6 mt-4 space-y-4">
        <h1 className="text-2xl font-bold">{resource.name}</h1>
        <Tabs>
          <TabsList>
            <TabLink href="?tab=deployments" isActive>
              Deployments
            </TabLink>
            <TabLink href="?tab=properties">Visualize</TabLink>
            <TabLink href="?tab=logs">Logs</TabLink>
            <TabLink href="?tab=logs">Audit Logs</TabLink>
            <TabLink href="?tab=logs">Variables</TabLink>
          </TabsList>
        </Tabs>
        {props.children}
      </div>
    </div>
  );
}
