import { Separator } from "@radix-ui/react-separator";
import { Link } from "react-router";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { DeploymentSummaries } from "./_components/DeploymentSummaries";
import { useEnvironment } from "./_components/EnvironmentProvider";
import { EnvironmentsNavbarTabs } from "./_components/EnvironmentsNavbarTabs";

export default function EnvironmentPage() {
  const { workspace } = useWorkspace();
  const { environment } = useEnvironment();
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
                  <Link to={`/${workspace.slug}/environments`}>
                    Environments
                  </Link>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbPage>{environment.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <EnvironmentsNavbarTabs environmentId={environment.id} />
      </header>

      <DeploymentSummaries />
    </>
  );
}
