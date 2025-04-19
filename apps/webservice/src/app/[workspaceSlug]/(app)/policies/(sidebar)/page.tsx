import Link from "next/link";
import { notFound } from "next/navigation";
import { IconMenu2, IconPlus } from "@tabler/icons-react";
import _ from "lodash";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Button } from "@ctrlplane/ui/button";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { api } from "~/trpc/server";
import { PageHeader } from "../../_components/PageHeader";
import { Sidebars } from "../../../sidebars";
import { PolicyPageContent } from "./PolicyPageContent";

export default async function RulesPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const workspaceSlug = (await params).workspaceSlug;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();

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
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbPage>Policies</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="ml-auto">
          <Link href={`/${workspaceSlug}/policies/create`}>
            <Button variant="outline" size="sm">
              <IconPlus className="mr-2 h-4 w-4" />
              Create Policy
            </Button>
          </Link>
        </div>
      </PageHeader>

      <PolicyPageContent workspace={workspace} />
    </div>
  );
}
