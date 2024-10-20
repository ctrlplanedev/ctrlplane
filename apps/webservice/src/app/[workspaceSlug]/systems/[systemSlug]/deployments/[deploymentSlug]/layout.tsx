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

export default async function DeploymentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: any;
}) {
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
    <>
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

      <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 h-[calc(100vh-53px-49px)] overflow-auto">
        {children}
      </div>
    </>
  );
}
