import Link from "next/link";
import { notFound } from "next/navigation";
import { IconMenu2, IconPlus, IconTag } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ctrlplane/ui/breadcrumb";
import { Button } from "@ctrlplane/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { api } from "~/trpc/server";
import { PageHeader } from "../../_components/PageHeader";
import { Sidebars } from "../../../sidebars";
import { VersionSelectorTable } from "./_components/VersionSelectorTable";

export default async function VersionSelectorsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const workspaceSlug = (await params).workspaceSlug;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();

  const policies = await api.policy.list(workspace.id);
  const policiesWithVersionSelectors = policies.filter(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    (p) => p.deploymentVersionSelector,
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader className="z-10">
        <div className="flex items-center gap-2">
          <SidebarTrigger name={Sidebars.Policies}>
            <IconMenu2 className="h-4 w-4" />
          </SidebarTrigger>
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/${workspaceSlug}/policies`}>Policies</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Version Selectors</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm">
            <IconPlus className="mr-2 h-4 w-4" />
            Create Version Selector
          </Button>
        </div>
      </PageHeader>

      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Version Selectors</h1>
          <p className="text-sm text-muted-foreground">
            Control which version of deployments can be released to environments
          </p>
        </div>

        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconTag className="h-5 w-5 text-indigo-400" />
                <span>What are Version Selectors?</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Version selectors allow you to define rules for which versions
                of a deployment can be released. For example, you can create a
                selector that only allows versions with specific tags or
                metadata to be deployed to production environments. This helps
                maintain consistent deployment practices and prevents unintended
                releases.
              </p>
            </CardContent>
          </Card>
        </div>

        <VersionSelectorTable policies={policiesWithVersionSelectors} />
      </div>
    </div>
  );
}
