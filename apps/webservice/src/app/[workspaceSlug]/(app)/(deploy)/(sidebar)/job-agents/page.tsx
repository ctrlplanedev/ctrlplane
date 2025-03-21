import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconMenu2 } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/server";
import { AgentCard } from "./AgentCard";

export const generateMetadata = async ({
  params,
}: {
  params: { workspaceSlug: string };
}): Promise<Metadata> => {
  const { workspaceSlug } = params;

  return api.workspace
    .bySlug(workspaceSlug)
    .then((workspace) => ({
      title: `Agents | ${workspace?.name ?? workspaceSlug} | Ctrlplane`,
      description: `Manage deployment agents for the ${workspace?.name ?? workspaceSlug} workspace.`,
    }))
    .catch(() => ({
      title: "Agents | Ctrlplane",
      description: "Manage and monitor deployment agents in Ctrlplane.",
    }));
};

export default async function AgentsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();
  const agents = await api.job.agent.byWorkspaceId(workspace.id);

  return (
    <div className="flex flex-col">
      <PageHeader className="z-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SidebarTrigger name={Sidebars.Deployments}>
            <IconMenu2 className="h-4 w-4" />
          </SidebarTrigger>
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbPage>Agents</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </PageHeader>

      <div className="flex w-full justify-center p-8">
        <div className="container max-w-3xl overflow-auto">
          {agents.map((agent, idx) => (
            <div key={agent.id} className="w-full">
              <AgentCard
                agent={agent}
                className={cn({
                  "rounded-t-md border-t": idx === 0,
                  "rounded-b-md border-b": idx === agents.length - 1,
                })}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
