import { Link, useParams } from "react-router";

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
import { useDeployment } from "../DeploymentProvider";
import { DeploymentsNavbarTabs } from "../DeploymentsNavbarTabs";

export function PlanDetailPageHeader() {
  const { workspace } = useWorkspace();
  const { deployment } = useDeployment();
  const { planId } = useParams<{ planId: string }>();

  const resultsQuery = trpc.deployment.plans.results.useQuery(
    { deploymentId: deployment.id, planId: planId! },
    { enabled: !!planId },
  );
  const version = resultsQuery.data?.version;

  return (
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
              <Link to={`/${workspace.slug}/deployments`}>Deployments</Link>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <Link to={`/${workspace.slug}/deployments/${deployment.id}`}>
                {deployment.name}
              </Link>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <Link
                to={`/${workspace.slug}/deployments/${deployment.id}/plans`}
              >
                Plans
              </Link>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbPage className="max-w-xs truncate font-mono">
              {version?.name ?? version?.tag ?? planId}
            </BreadcrumbPage>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-4">
        <DeploymentsNavbarTabs />
      </div>
    </header>
  );
}
