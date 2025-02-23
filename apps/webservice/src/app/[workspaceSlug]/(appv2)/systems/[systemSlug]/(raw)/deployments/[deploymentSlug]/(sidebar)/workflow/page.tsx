import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Separator } from "@ctrlplane/ui/separator";

import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { api } from "~/trpc/server";
import { JobAgentSection } from "./JobAgentSection";

export default async function WorkflowPage(props: {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) return notFound();
  const workspaceId = workspace.id;
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();
  const jobAgents = await api.job.agent.byWorkspaceId(workspaceId);
  const jobAgent = jobAgents.find((a) => a.id === deployment.jobAgentId);

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
              <BreadcrumbItem>
                <BreadcrumbPage>Workflow</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </PageHeader>
      <div className="container">
        <JobAgentSection
          jobAgents={jobAgents}
          workspace={workspace}
          jobAgent={jobAgent}
          jobAgentConfig={deployment.jobAgentConfig}
          deploymentId={deployment.id}
        />
      </div>
    </div>
  );
}
