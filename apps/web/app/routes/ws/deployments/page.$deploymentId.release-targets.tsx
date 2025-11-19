/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import type { FC } from "react";
import { useState } from "react";
import { Fragment } from "react/jsx-runtime";
import _ from "lodash";
import { ChevronRight, Search } from "lucide-react";
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
import { Button } from "~/components/ui/button";
import { ResourceIcon } from "~/components/ui/resource-icon";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Table, TableBody, TableCell, TableRow } from "~/components/ui/table";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { cn } from "~/lib/utils";
import {
  JobStatusBadge,
  JobStatusDisplayName,
} from "../_components/JobStatusBadge";
import { Input } from "../../../components/ui/input";
import { useDeployment } from "./_components/DeploymentProvider";
import { DeploymentsNavbarTabs } from "./_components/DeploymentsNavbarTabs";
import { RedeployDialog } from "./_components/RedeployDialog";

type ReleaseTarget = {
  releaseTarget: {
    deploymentId: string;
    environmentId: string;
    resourceId: string;
  };
  resource?: {
    id: string;
    name: string;
    version: string;
    kind: string;
    identifier: string;
  };
  environment?: {
    id: string;
    name: string;
    resourceSelector?: { json?: Record<string, unknown>; cel?: string };
  };
  state: {
    latestJob?: {
      status?: string;
    };
    currentRelease?: {
      version: {
        tag: string;
        name?: string;
      };
    };
    desiredRelease?: {
      version: {
        tag: string;
        name?: string;
      };
    };
  };
};

type Environment = {
  id: string;
  name: string;
  resourceSelector?:
    | {
        json: Record<string, unknown>;
      }
    | {
        cel: string;
      };
};

type EnvironmentReleaseTargetsGroupProps = {
  releaseTargets: ReleaseTarget[];
  environment: Environment;
};

const EnvironmentReleaseTargetsGroup: FC<
  EnvironmentReleaseTargetsGroupProps
> = ({ releaseTargets, environment }) => {
  const [open, setOpen] = useState(true);

  let cel: string | undefined = undefined;
  let jsonSelector: string | undefined = undefined;

  if (environment.resourceSelector) {
    if ("cel" in environment.resourceSelector) {
      cel = environment.resourceSelector.cel;
    }
    if ("json" in environment.resourceSelector) {
      jsonSelector = JSON.stringify(environment.resourceSelector.json, null, 2);
    }
  }

  const rts = open ? releaseTargets : [];

  return (
    <Fragment key={environment.id}>
      <TableRow key={environment.id}>
        <TableCell colSpan={4} className="bg-muted/50">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setOpen(!open)}
              className="size-5 shrink-0"
            >
              <ChevronRight
                className={cn("s-4 transition-transform", open && "rotate-90")}
              />
            </Button>
            <div className="grow">{environment.name} </div>
            <span className="max-w-[60vw] shrink-0 truncate font-mono text-xs text-muted-foreground">
              {cel?.replaceAll("\n", " ").trim() ??
                jsonSelector?.trim().replaceAll("\n", " ")}
            </span>
          </div>
        </TableCell>
      </TableRow>
      {rts.map(({ releaseTarget, state, resource }) => {
        const fromVersionRaw =
          state.currentRelease?.version.name ||
          state.currentRelease?.version.tag;
        const toVersion =
          (state.desiredRelease?.version.name ||
            state.desiredRelease?.version.tag) ??
          "unknown";
        const isInSync = !!fromVersionRaw && fromVersionRaw === toVersion;

        let versionDisplay;
        if (!fromVersionRaw) {
          versionDisplay = (
            <span className="italic text-neutral-500">
              Not yet deployed → {toVersion}
            </span>
          );
        } else if (isInSync) {
          versionDisplay = toVersion;
        } else {
          versionDisplay = `${fromVersionRaw} → ${toVersion}`;
        }

        return (
          <TableRow key={releaseTarget.resourceId}>
            <TableCell>
              <div className="flex items-center gap-2">
                <ResourceIcon
                  kind={resource?.kind ?? ""}
                  version={resource?.version ?? ""}
                />
                {resource?.name}
              </div>
            </TableCell>
            <TableCell>
              <JobStatusBadge
                status={
                  (state.latestJob?.status ??
                    "unknown") as keyof typeof JobStatusDisplayName
                }
              />
            </TableCell>
            <TableCell
              className={cn(
                isInSync ? "text-green-500" : "text-blue-500",
                "text-right font-mono text-sm",
              )}
            >
              {versionDisplay}
            </TableCell>
            <TableCell className="text-right">
              <RedeployDialog releaseTarget={releaseTarget} />
            </TableCell>
          </TableRow>
        );
      })}
    </Fragment>
  );
};

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
