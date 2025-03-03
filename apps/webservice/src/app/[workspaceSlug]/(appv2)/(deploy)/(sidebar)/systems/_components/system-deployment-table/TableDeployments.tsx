"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import Link from "next/link";
import { IconFolder, IconLoader2 } from "@tabler/icons-react";
import { isPresent } from "ts-is-present";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";

import { DeploymentDirectoryCell } from "~/app/[workspaceSlug]/(appv2)/(deploy)/_components/deployments/DeploymentDirectoryCell";
import { LazyDeploymentEnvironmentCell } from "~/app/[workspaceSlug]/(appv2)/(deploy)/_components/deployments/environment-cell/DeploymentEnvironmentCell";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

const EnvHeader: React.FC<{
  environment: SCHEMA.Environment;
  workspace: SCHEMA.Workspace;
}> = ({ environment: env, workspace }) => {
  const filter = env.resourceFilter ?? undefined;
  const { data, isLoading } = api.resource.byWorkspaceId.list.useQuery(
    { workspaceId: workspace.id, filter, limit: 0 },
    { enabled: filter != null },
  );
  const total = data?.total ?? 0;

  const envUrl = `/${workspace.slug}/systems?environment_id=${env.id}`;
  return (
    <TableHead className="w-[220px] p-2" key={env.id}>
      <Link
        href={envUrl}
        className="flex w-fit items-center gap-2 rounded-md px-2 py-1 text-white hover:bg-secondary/50"
      >
        <span className=" max-w-36 truncate">{env.name}</span>

        <Badge variant="outline" className="rounded-full text-muted-foreground">
          {isLoading && (
            <IconLoader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
          {!isLoading && total}
        </Badge>
      </Link>
    </TableHead>
  );
};

const DirectoryHeader: React.FC<{
  directory: {
    path: string;
    environments: SCHEMA.Environment[];
  };
  workspace: SCHEMA.Workspace;
}> = ({ directory, workspace }) => {
  const resourceFilters = directory.environments
    .map((env) => env.resourceFilter)
    .filter(isPresent);
  const filter: ResourceCondition | undefined =
    resourceFilters.length > 0
      ? {
          type: FilterType.Comparison,
          operator: ComparisonOperator.Or,
          conditions: resourceFilters,
        }
      : undefined;

  const { data: resourcesResult, isLoading } =
    api.resource.byWorkspaceId.list.useQuery(
      { workspaceId: workspace.id, filter, limit: 0 },
      { enabled: filter != null },
    );

  const total = resourcesResult?.total ?? 0;

  return (
    <TableHead className="w-[220px] p-2" key={directory.path}>
      <div className="flex w-fit items-center gap-2 px-2 py-1 text-white">
        <span className=" max-w-32 truncate">{directory.path}</span>

        <Badge variant="outline" className="rounded-full text-muted-foreground">
          {isLoading && (
            <IconLoader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
          {!isLoading && total}
        </Badge>

        <Badge variant="outline" className="rounded-full text-muted-foreground">
          <IconFolder className="h-4 w-4" strokeWidth={1.5} />
        </Badge>
      </div>
    </TableHead>
  );
};

const DeploymentTable: React.FC<{
  workspace: SCHEMA.Workspace;
  systemSlug: string;
  environments: SCHEMA.Environment[];
  deployments: SCHEMA.Deployment[];
  directories: {
    path: string;
    environments: SCHEMA.Environment[];
  }[];
}> = ({ systemSlug, deployments, environments, workspace, directories }) => {
  return (
    <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 w-full overflow-x-auto">
      <Table className="w-full min-w-max bg-background">
        <TableHeader className="[&_tr]:border-0">
          <TableRow className="hover:bg-transparent">
            <TableHead className="sticky left-0 z-10 w-[350px] rounded-md py-4 pl-6 backdrop-blur-lg">
              Deployments
            </TableHead>
            {environments.map((env) => (
              <EnvHeader key={env.id} environment={env} workspace={workspace} />
            ))}
            {directories.map((dir) => (
              <DirectoryHeader
                key={dir.path}
                directory={dir}
                workspace={workspace}
              />
            ))}
            <TableCell className="flex-grow" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {deployments.map((r, idx) => (
            <TableRow
              key={r.id}
              className="w-full border-0 bg-background hover:bg-transparent"
            >
              <TableCell
                className={cn(
                  "sticky left-0 z-10 h-[70px] w-[350px] max-w-[300px] backdrop-blur-lg",
                  idx === deployments.length - 1 && "rounded-b-md",
                )}
              >
                <div className="flex min-w-0 items-center justify-between gap-2 px-2 text-lg">
                  <Link
                    href={urls
                      .workspace(workspace.slug)
                      .system(systemSlug)
                      .deployment(r.slug)
                      .baseUrl()}
                    className="truncate hover:text-blue-300"
                    title={r.name}
                  >
                    {r.name}
                  </Link>
                </div>
              </TableCell>
              {environments.map((env) => (
                <TableCell key={env.id} className="h-[70px] w-[220px]">
                  <div className="flex h-full w-full justify-center">
                    <LazyDeploymentEnvironmentCell
                      environment={env}
                      deployment={r}
                      workspace={workspace}
                      systemSlug={systemSlug}
                    />
                  </div>
                </TableCell>
              ))}
              {directories.map((dir) => (
                <TableCell key={dir.path} className="h-[70px] w-[220px]">
                  <div className="flex h-full w-full justify-center">
                    <DeploymentDirectoryCell
                      directory={dir}
                      deployment={r}
                      systemSlug={systemSlug}
                    />
                  </div>
                </TableCell>
              ))}
              <TableCell className="flex-grow" />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default DeploymentTable;
