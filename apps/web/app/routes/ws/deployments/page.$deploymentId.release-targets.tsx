import { useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Table, TableBody } from "~/components/ui/table";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { JobStatusDisplayName } from "../_components/JobStatusBadge";
import { useDeployment } from "./_components/DeploymentProvider";
import { DeploymentsNavbarTabs } from "./_components/DeploymentsNavbarTabs";
import { EnvironmentReleaseTargetsGroup } from "./_components/release-targets/EnvironmentReleaseTargetsGroup";

function useResource() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("resource") ?? "";
  const [search, setSearch] = useState(query);
  const [searchDebounced, setSearchDebounced] = useState(search);
  useDebounce(
    () => {
      setSearchDebounced(search);
      const newSearchParams = new URLSearchParams(searchParams);
      if (search === "") newSearchParams.delete("query");
      if (search !== "") newSearchParams.set("query", search);
      setSearchParams(newSearchParams);
    },
    500,
    [search, searchParams],
  );

  return { search, setSearch, searchDebounced };
}

function useJobStatus() {
  const [searchParams, setSearchParams] = useSearchParams();
  const jobStatus = searchParams.get("jobStatus") as
    | keyof typeof JobStatusDisplayName
    | undefined;

  const setJobStatus = (jobStatus: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (jobStatus === "all") newSearchParams.delete("jobStatus");
    if (jobStatus !== "all") newSearchParams.set("jobStatus", jobStatus);
    setSearchParams(newSearchParams);
  };

  return { jobStatus, setJobStatus };
}

function JobStatusSelect() {
  const { jobStatus, setJobStatus } = useJobStatus();
  return (
    <Select value={jobStatus} onValueChange={setJobStatus}>
      <SelectTrigger>
        {jobStatus == null
          ? "Select job status"
          : JobStatusDisplayName[jobStatus]}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        {Object.keys(JobStatusDisplayName).map((status) => (
          <SelectItem key={status} value={status}>
            {JobStatusDisplayName[status as keyof typeof JobStatusDisplayName]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function ReleaseTargetsPage() {
  const { workspace } = useWorkspace();
  const { deployment } = useDeployment();
  const { search, setSearch, searchDebounced } = useResource();
  const { jobStatus } = useJobStatus();

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

  const environmentIds = useMemo(() => {
    return new Set(
      deployment.systemDeployments.flatMap((sd) =>
        sd.system.systemEnvironments.map((se) => se.environmentId),
      ),
    );
  }, [deployment.systemDeployments]);

  const environments =
    environmentsQuery.data?.filter((environment) =>
      environmentIds.has(environment.id),
    ) ?? [];

  const releaseTargets = releaseTargetsQuery.data?.items ?? [];
  const filteredReleaseTargets = releaseTargets.filter((rt) => {
    if (jobStatus == null) return true;
    return rt.latestJob?.status === jobStatus;
  });

  const groupByEnvironmentId = _.groupBy(
    filteredReleaseTargets,
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
          <div className="relative flex-1 grow">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search resources..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <JobStatusSelect />
        </div>

        <Table className="border-b">
          <TableBody>
            {environments.map((environment) => {
              const releaseTargets = groupByEnvironmentId[environment.id] ?? [];
              if (releaseTargets.length === 0) return null;
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
