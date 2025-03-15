import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconMenu2 } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ctrlplane/ui/breadcrumb";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/server";
import { CreateRunbook } from "./CreateRunbookForm";

export const metadata: Metadata = {
  title: "Create Runbook",
  description: "Create a new runbook for your system",
};

type PageProps = {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
  }>;
};

export default async function CreateRunbookPage(props: PageProps) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();
  const system = await api.system.bySlug(params).catch(notFound);
  const jobAgents = await api.job.agent.byWorkspaceId(workspace.id);
  return (
    <div>
      <PageHeader>
        <SidebarTrigger name={Sidebars.System}>
          <IconMenu2 className="h-4 w-4" />
        </SidebarTrigger>
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink
                href={`/${workspace.slug}/systems/${system.slug}/runbooks`}
              >
                Runbooks
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Create</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>

      <div className="h-full overflow-y-auto p-8 py-16 pb-24">
        <CreateRunbook
          jobAgents={jobAgents}
          system={system}
          workspace={workspace}
        />
      </div>
    </div>
  );
}
