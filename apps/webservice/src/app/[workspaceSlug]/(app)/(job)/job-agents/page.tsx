import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconFilter } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { ResizablePanel, ResizablePanelGroup } from "@ctrlplane/ui/resizable";

import { api } from "~/trpc/server";
import { JobAgentsGettingStarted } from "./JobAgentsGettingStarted";
import { JobAgentsTable } from "./JobAgentsTable";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  return {
    title: `Job Agents - ${params.workspaceSlug}`,
  };
}

export default async function JobAgentsPage(props: PageProps) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();

  const jobAgents = await api.job.agent.byWorkspaceId(workspace.id);
  if (jobAgents.length === 0)
    return <JobAgentsGettingStarted workspaceSlug={params.workspaceSlug} />;
  return (
    <>
      <div className="border-b p-1 filter">
        <Button variant="ghost" size="sm" className="flex gap-1">
          <IconFilter className="h-4 w-4" /> Filter
        </Button>
      </div>

      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel className="text-sm" defaultSize={60}>
          <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-[calc(100vh-40px)] overflow-auto">
            <JobAgentsTable jobAgents={jobAgents} />
          </div>
        </ResizablePanel>
        {/* <ResizableHandle /> */}
      </ResizablePanelGroup>
    </>
  );
}
