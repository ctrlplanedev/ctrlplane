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
import { PageHeader } from "../../_components/PageHeader";

const TabLink: React.FC<{
  href: string;
  isActive?: boolean;
  children: React.ReactNode;
}> = ({ href, isActive, children }) => {
  return (
    <Link
      href={href}
      data-state={isActive ? "active" : undefined}
      className="relative border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 text-sm text-muted-foreground shadow-none transition-none focus-visible:ring-0 data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
    >
      {children}
    </Link>
  );
};

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
        <div className="relative mb-6 mr-auto w-full border-b">
          <div className="flex w-full justify-start">
            <TabLink href="?tab=deployments" isActive>
              Deployments
            </TabLink>
            <TabLink href="?tab=properties">Visualize</TabLink>
            <TabLink href="?tab=logs">Logs</TabLink>
            <TabLink href="?tab=logs">Audit Logs</TabLink>
            <TabLink href="?tab=logs">Variables</TabLink>
          </div>
        </div>
        {props.children}
      </div>
    </div>
  );
}
