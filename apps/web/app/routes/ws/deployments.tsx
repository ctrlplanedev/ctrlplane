import { useState } from "react";
import { AlertCircle, Filter, Search } from "lucide-react";
import { useSearchParams } from "react-router";

import { trpc } from "~/api/trpc";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { CreateDeploymentDialog } from "./_components/CreateDeploymentDialog";
import { LazyLoadDeploymentCard } from "./deployments/_components/DeploymentCard";

export function meta() {
  return [
    { title: "Deployments - Ctrlplane" },
    { name: "description", content: "Manage your deployments" },
  ];
}

export default function Deployments() {
  const { workspace } = useWorkspace();
  const deploymentsQuery = trpc.deployment.list.useQuery({
    workspaceId: workspace.id,
  });
  const deploymentsWithSystems = deploymentsQuery.data?.items ?? [];
  const [searchQuery, setSearchQuery] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const systemFilter = searchParams.get("system") ?? "all";

  const handleSystemFilterChange = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === "all") {
      newParams.delete("system");
    } else {
      newParams.set("system", value);
    }
    setSearchParams(newParams);
  };

  // Get unique systems for filter
  const systems = Array.from(
    new Set(
      deploymentsWithSystems.flatMap((d) => d.systems.map((s) => s.name)),
    ),
  );

  const filteredDeployments = deploymentsWithSystems.filter((d) => {
    if (searchQuery) {
      return d.deployment.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    }
    if (systemFilter !== "all") {
      return d.systems.some((s) => s.name === systemFilter);
    }
    return true;
  });

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
                <BreadcrumbPage>Deployments</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <CreateDeploymentDialog>
          <Button>Create Deployment</Button>
        </CreateDeploymentDialog>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        {/* Filters and Search */}

        <div className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search deployments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={systemFilter}
                onValueChange={handleSystemFilterChange}
              >
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="System" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Systems</SelectItem>
                  {systems.sort().map((system) => (
                    <SelectItem key={system} value={system}>
                      {system}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Healthy">Healthy</SelectItem>
                  <SelectItem value="Progressing">Progressing</SelectItem>
                  <SelectItem value="Degraded">Degraded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div
          className={"grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}
        >
          {filteredDeployments.map(
            ({ deployment, systems: deploymentSystems }) => (
              <LazyLoadDeploymentCard
                deployment={deployment}
                systems={deploymentSystems}
                key={deployment.id}
              />
            ),
          )}
        </div>

        {deploymentsWithSystems.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">
                No deployments found
              </h3>
              <p className="text-center text-sm text-muted-foreground">
                Try adjusting your search or filter criteria
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
