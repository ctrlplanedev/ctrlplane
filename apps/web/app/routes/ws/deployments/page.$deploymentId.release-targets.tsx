import { Link } from "react-router";

import { trpc } from "~/api/trpc";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useDeployment } from "./_components/DeploymentProvider";

export default function ReleaseTargetsPage() {
  const { workspace } = useWorkspace();
  const { deployment } = useDeployment();

  const releaseTargetsQuery = trpc.deployment.releaseTargets.useQuery({
    workspaceId: workspace.id,
    deploymentId: deployment.id,
    limit: 1000,
    offset: 0,
  });

  const environmentsQuery = trpc.environment.list.useQuery({
    workspaceId: workspace.id,
  });

  const releaseTargets = releaseTargetsQuery.data?.items ?? [];

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b pr-4">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbItem>
                  <Link to={`/${workspace.slug}/deployments`}>Deployments</Link>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <Link to={`/${workspace.slug}/deployments/${deployment.id}`}>
                    {deployment.name}
                  </Link>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbPage>Targets</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div>
        {releaseTargets.map(({ releaseTarget }) => {
          const environment = environmentsQuery.data?.items.find(
            (e) => e.id === releaseTarget.environmentId,
          );
          return (
            <div
              key={releaseTarget.resourceId}
              className="flex items-center gap-2"
            >
              <div></div>
              <div>{releaseTarget.deploymentId}</div>
              <div>
                {releaseTarget.environmentId} {releaseTarget.resourceId}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
