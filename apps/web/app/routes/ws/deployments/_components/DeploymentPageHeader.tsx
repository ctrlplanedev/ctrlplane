import { PackagePlus } from "lucide-react";
import { Link } from "react-router";

import { trpc } from "~/api/trpc";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { CreateVersionDialog } from "./CreateVersionDialog";
import { useDeployment } from "./DeploymentProvider";
import { DeploymentsNavbarTabs } from "./DeploymentsNavbarTabs";

const useNoVersions = () => {
  const { deployment } = useDeployment();
  const { workspace } = useWorkspace();
  const versionsQuery = trpc.deployment.versions.useQuery(
    {
      workspaceId: workspace.id,
      deploymentId: deployment.id,
      limit: 1000,
      offset: 0,
    },
    { refetchInterval: 5000 },
  );
  return !versionsQuery.isLoading && versionsQuery.data?.items.length === 0;
};

export function DeploymentPageHeader() {
  const { deployment } = useDeployment();
  const { workspace } = useWorkspace();
  const noVersions = useNoVersions();

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
              <BreadcrumbItem>
                <Link to={`/${workspace.slug}/deployments`}>Deployments</Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbPage>{deployment.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-4">
        {!noVersions && (
          <CreateVersionDialog deploymentId={deployment.id}>
            <Button variant="outline">
              <PackagePlus className="mr-2 h-4 w-4" />
              Create Version
            </Button>
          </CreateVersionDialog>
        )}
        <DeploymentsNavbarTabs />
      </div>
    </header>
  );
}
