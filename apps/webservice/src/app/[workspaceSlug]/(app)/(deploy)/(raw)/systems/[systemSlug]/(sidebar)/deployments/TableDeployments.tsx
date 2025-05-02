"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import React from "react";
import Link from "next/link";
import { IconDotsVertical, IconFolder, IconLoader2 } from "@tabler/icons-react";
import { isPresent } from "ts-is-present";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  ComparisonOperator,
  ConditionType,
} from "@ctrlplane/validators/conditions";

import { DeploymentDirectoryCell } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployments/DeploymentDirectoryCell";
import { DeploymentOptionsDropdown } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployments/dropdown/DeploymentOptionsDropdown";
import { LazyDeploymentEnvironmentCell } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployments/environment-cell/DeploymentEnvironmentCell";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

type Deployment = RouterOutputs["deployment"]["bySystemId"][number];

const Icon: React.FC<{ children?: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <th
    className={cn(
      "sticky left-0 h-10 border-b p-2 px-3 text-left text-sm font-normal text-muted-foreground",
      className,
    )}
  >
    {children}
  </th>
);

const EnvIcon: React.FC<{
  environment: SCHEMA.Environment;
  workspace: SCHEMA.Workspace;
  systemSlug: string;
  className?: string;
}> = ({ environment: env, workspace, systemSlug, className }) => {
  const filter = env.resourceSelector ?? undefined;
  const { data: resourcesResult, isLoading } =
    api.resource.byWorkspaceId.list.useQuery(
      { workspaceId: workspace.id, filter, limit: 0 },
      { enabled: filter != null },
    );
  const total = resourcesResult?.total ?? 0;

  const systemUrls = urls.workspace(workspace.slug).system(systemSlug);
  const envUrl = systemUrls.environment(env.id).baseUrl();
  return (
    <Icon key={env.id} className={className}>
      <Link href={envUrl}>
        <div className="flex justify-between">
          {env.name}

          <Badge
            variant="outline"
            className="rounded-full text-muted-foreground"
          >
            {isLoading && (
              <IconLoader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
            {!isLoading && total}
          </Badge>
        </div>
      </Link>
    </Icon>
  );
};

const DirectoryHeader: React.FC<{
  directory: {
    path: string;
    environments: SCHEMA.Environment[];
  };
  workspace: SCHEMA.Workspace;
}> = ({ directory, workspace }) => {
  const resourceSelectors = directory.environments
    .map((env) => env.resourceSelector)
    .filter(isPresent);
  const filter: ResourceCondition | undefined =
    resourceSelectors.length > 0
      ? {
          type: ConditionType.Comparison,
          operator: ComparisonOperator.Or,
          conditions: resourceSelectors,
        }
      : undefined;

  const { data: resourcesResult, isLoading } =
    api.resource.byWorkspaceId.list.useQuery(
      { workspaceId: workspace.id, filter, limit: 0 },
      { enabled: filter != null },
    );

  const total = resourcesResult?.total ?? 0;

  return (
    <Icon key={directory.path}>
      <div className="flex items-center justify-between">
        {directory.path}

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="rounded-full text-muted-foreground"
          >
            {isLoading && (
              <IconLoader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
            {!isLoading && total}
          </Badge>

          <Badge
            variant="outline"
            className="rounded-full text-muted-foreground"
          >
            <IconFolder className="h-4 w-4" strokeWidth={1.5} />
          </Badge>
        </div>
      </div>
    </Icon>
  );
};

const DeploymentTable: React.FC<{
  workspace: SCHEMA.Workspace;
  systemSlug: string;
  className?: string;
  rootEnvironments: SCHEMA.Environment[];
  directories: {
    path: string;
    environments: SCHEMA.Environment[];
  }[];
  deployments: Deployment[];
}> = ({
  systemSlug,
  deployments,
  rootEnvironments,
  directories,
  workspace,
  className,
}) => {
  return (
    <div
      className={cn(
        "scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 w-full overflow-x-auto",
        className,
      )}
    >
      <table className="w-full min-w-max border-separate border-spacing-0">
        <thead>
          <tr>
            <Icon className="sticky left-0 z-10 rounded-tl border-r backdrop-blur-lg">
              Deployment
            </Icon>
            {rootEnvironments.map((env, idx) => (
              <EnvIcon
                key={env.id}
                environment={env}
                workspace={workspace}
                systemSlug={systemSlug}
                className={cn({
                  "border-r":
                    directories.length > 0 ||
                    idx !== rootEnvironments.length - 1,
                })}
              />
            ))}
            {directories.map((dir) => (
              <DirectoryHeader
                key={dir.path}
                directory={dir}
                workspace={workspace}
              />
            ))}
          </tr>
        </thead>

        <tbody>
          {deployments.map((r, didx) => (
            <tr key={r.id} className="bg-background">
              <td
                className={cn(
                  "sticky left-0 z-10 min-w-[250px] flex-grow items-center border-r px-4 backdrop-blur-lg",
                  {
                    "border-b": didx !== deployments.length - 1,
                    "rounded-bl": didx === deployments.length - 1,
                  },
                )}
              >
                <div className="flex w-full items-center gap-2">
                  <Link
                    href={urls
                      .workspace(workspace.slug)
                      .system(systemSlug)
                      .deployment(r.slug)
                      .baseUrl()}
                    className="flex-grow truncate hover:text-blue-300"
                    title={r.name}
                  >
                    {r.name}
                  </Link>
                  <DeploymentOptionsDropdown {...r}>
                    <Button size="icon" variant="ghost">
                      <IconDotsVertical className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DeploymentOptionsDropdown>
                </div>
              </td>

              {rootEnvironments.map((env, idx) => {
                return (
                  <td
                    key={env.id}
                    className={cn("h-[70px] w-[220px] px-2 py-1", {
                      "border-r":
                        directories.length > 0 ||
                        idx !== rootEnvironments.length - 1,
                      "border-b": didx !== deployments.length - 1,
                    })}
                  >
                    <LazyDeploymentEnvironmentCell
                      environment={env}
                      deployment={r}
                      systemSlug={systemSlug}
                    />
                  </td>
                );
              })}

              {directories.map((dir, dirIdx) => {
                return (
                  <td
                    key={dir.path}
                    className={cn("h-[70px] w-[220px] px-2 py-1", {
                      "border-r": dirIdx !== directories.length - 1,
                      "border-b": didx !== deployments.length - 1,
                    })}
                  >
                    <DeploymentDirectoryCell
                      directory={dir}
                      deployment={r}
                      systemSlug={systemSlug}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DeploymentTable;
