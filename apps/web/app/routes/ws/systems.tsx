import { AlertCircle } from "lucide-react";

import { trpc } from "~/api/trpc";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { CreateSystemDialog } from "./_components/CreateSystemDialog";

export function meta() {
  return [
    { title: "Systems - Ctrlplane" },
    {
      name: "description",
      content: "Manage your systems",
    },
  ];
}

export default function Systems() {
  const { workspace } = useWorkspace();
  const { data: systemsData, isLoading: isLoadingSystems } =
    trpc.system.list.useQuery({
      workspaceId: workspace.id,
    });

  const { data: deploymentsData } = trpc.deployment.list.useQuery({
    workspaceId: workspace.id,
  });

  const { data: environmentsData } = trpc.environment.list.useQuery({
    workspaceId: workspace.id,
  });

  const systems = systemsData?.items ?? [];
  const deployments = deploymentsData?.items ?? [];
  const environments = environmentsData?.items ?? [];

  // Count deployments and environments per system
  const getSystemCounts = (systemId: string) => {
    const deploymentCount = deployments.filter(
      (d) => d.deployment.systemId === systemId,
    ).length;
    const environmentCount = environments.filter(
      (e) => e.systemId === systemId,
    ).length;
    return { deploymentCount, environmentCount };
  };

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Systems</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <CreateSystemDialog>
          <Button>Create System</Button>
        </CreateSystemDialog>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        {/* Loading State */}
        {isLoadingSystems && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="mt-4 text-sm text-muted-foreground">
                Loading systems...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Systems Grid */}
        {!isLoadingSystems && systems.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {systems.map((system) => {
              const { deploymentCount, environmentCount } = getSystemCounts(
                system.id,
              );
              return (
                <Card key={system.id}>
                  <CardContent>
                    <h3 className="mb-2 font-semibold">{system.name}</h3>
                    {system.description && (
                      <p className="mb-4 text-sm text-muted-foreground">
                        {system.description}
                      </p>
                    )}
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">{deploymentCount}</span>{" "}
                        deployment{deploymentCount !== 1 ? "s" : ""}
                      </div>
                      <div>
                        <span className="font-medium">{environmentCount}</span>{" "}
                        environment{environmentCount !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoadingSystems && systems.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No systems found</h3>
              <p className="text-center text-sm text-muted-foreground">
                Get started by creating your first system
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
