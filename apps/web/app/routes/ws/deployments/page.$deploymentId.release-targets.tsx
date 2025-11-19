/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import { useState } from "react";
import _ from "lodash";
import { Search } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { useDebounce } from "react-use";

import { trpc } from "~/api/trpc";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Table, TableBody } from "~/components/ui/table";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useDeployment } from "./_components/DeploymentProvider";
import { DeploymentsNavbarTabs } from "./_components/DeploymentsNavbarTabs";
import { EnvironmentReleaseTargetsGroup } from "./_components/release-targets/EnvironmentReleaseTargetsGroup";

function useResourceName() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("resourceName") ?? "";
  const [search, setSearch] = useState(query);
  const [searchDebounced, setSearchDebounced] = useState(search);
  useDebounce(
    () => {
      setSearchDebounced(search);
      setSearchParams({ resourceName: search });
    },
    500,
    [search],
  );

  return { search, setSearch, searchDebounced };
}

export default function ReleaseTargetsPage() {
  const { workspace } = useWorkspace();
  const { deployment } = useDeployment();
  const { search, setSearch, searchDebounced } = useResourceName();

  const releaseTargetsQuery = trpc.deployment.releaseTargets.useQuery({
    workspaceId: workspace.id,
    deploymentId: deployment.id,
    query: searchDebounced,
    limit: 1000,
    offset: 0,
  });

  const environmentsQuery = trpc.environment.list.useQuery({
    workspaceId: workspace.id,
  });

  const environments =
    environmentsQuery.data?.items.filter(
      (environment) => environment.systemId === deployment.systemId,
    ) ?? [];

  const releaseTargets = releaseTargetsQuery.data?.items ?? [];

  const groupByEnvironmentId = _.groupBy(
    releaseTargets,
    (rt) => rt.releaseTarget.environmentId,
  );
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

        <DeploymentsNavbarTabs />
      </header>
      <div>
        <div className="flex items-center gap-2 p-2">
          <div className="relative flex-1 flex-grow">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search resources..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Table className="border-b">
          <TableBody>
            {environments.map((environment) => {
              const releaseTargets = groupByEnvironmentId[environment.id] ?? [];
              return (
                <EnvironmentReleaseTargetsGroup
                  key={environment.id}
                  releaseTargets={releaseTargets}
                  environment={environment}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
