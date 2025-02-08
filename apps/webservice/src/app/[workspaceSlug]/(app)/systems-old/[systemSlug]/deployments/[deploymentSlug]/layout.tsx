import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconAlertTriangle } from "@tabler/icons-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { api } from "~/trpc/server";
import { SystemBreadcrumbNavbar } from "../../../SystemsBreadcrumb";
import { TopNav } from "../../../TopNav";
import { DeploymentNavBar } from "./DeploymentNavBar";

type PageProps = {
  params: Promise<{ workspaceSlug: string; systemSlug: string; deploymentSlug: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();

  return {
    title: `${deployment.name} | Deployments`,
  };
}

export default async function DeploymentLayout(
  props: {
    children: React.ReactNode;
  } & PageProps
) {
  const params = await props.params;

  const {
    children
  } = props;

  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) return notFound();
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();

  const releases = await api.release.list({
    deploymentId: deployment.id,
    limit: 0,
  });

  const overviewUrl = `/${params.workspaceSlug}/systems/${params.systemSlug}/deployments/${params.deploymentSlug}`;
  return (
    <div className="flex max-h-screen max-w-[calc(100vw-256px)] flex-col">
      <TopNav>
        <div className="flex items-center">
          <SystemBreadcrumbNavbar params={params} />
          {deployment.jobAgentId == null && (
            <div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      className="flex items-center text-yellow-500"
                      href={overviewUrl}
                    >
                      <IconAlertTriangle className="h-4 w-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[300px]">
                    <p>
                      Deployment has not been configured with a job agent, and
                      therefore creating releases will not trigger a job.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </TopNav>
      <DeploymentNavBar
        deployment={deployment}
        totalReleases={releases.total}
      />

      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 overflow-auto">
        {children}
      </div>
    </div>
  );
}
