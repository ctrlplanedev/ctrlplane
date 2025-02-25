"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type { Workspace } from "@ctrlplane/db/schema";
import Link from "next/link";
import { IconLoader2 } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";

import { DeploymentOptionsDropdown } from "~/app/[workspaceSlug]/(appv2)/systems/[systemSlug]/_components/deployments/dropdown/DeploymentOptionsDropdown";
import { LazyDeploymentEnvironmentCell } from "~/app/[workspaceSlug]/(appv2)/systems/[systemSlug]/_components/deployments/environment-cell/DeploymentEnvironmentCell";
import { api } from "~/trpc/react";

type Environment = RouterOutputs["environment"]["bySystemId"][number];
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
  environment: Environment;
  workspaceSlug: string;
  systemSlug: string;
  className?: string;
}> = ({ environment: env, workspaceSlug, systemSlug, className }) => {
  const { data: workspace, isLoading: isWorkspaceLoading } =
    api.workspace.bySlug.useQuery(workspaceSlug);
  const workspaceId = workspace?.id ?? "";

  const filter = env.resourceFilter ?? undefined;
  const { data: resourcesResult, isLoading: isResourcesLoading } =
    api.resource.byWorkspaceId.list.useQuery(
      { workspaceId, filter, limit: 0 },
      { enabled: workspaceId !== "" && filter != null },
    );
  const total = resourcesResult?.total ?? 0;

  const isLoading = isWorkspaceLoading || isResourcesLoading;

  const envUrl = `/${workspaceSlug}/systems/${systemSlug}/deployments?environment_id=${env.id}`;
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

const DeploymentTable: React.FC<{
  workspace: Workspace;
  systemSlug: string;
  className?: string;
  environments: Environment[];
  deployments: Deployment[];
}> = ({ systemSlug, deployments, environments, workspace, className }) => {
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
            {environments.map((env, idx) => (
              <EnvIcon
                key={env.id}
                environment={env}
                workspaceSlug={workspace.slug}
                systemSlug={systemSlug}
                className={cn({ "border-r": idx !== environments.length - 1 })}
              />
            ))}
          </tr>
        </thead>

        <tbody>
          {deployments.map((r, didx) => (
            <tr key={r.id} className="bg-background">
              <td
                className={cn(
                  "sticky left-0 z-10 w-[250px] items-center border-r px-4 backdrop-blur-lg",
                  {
                    "border-b": didx !== deployments.length - 1,
                    "rounded-bl": didx === deployments.length - 1,
                  },
                )}
              >
                <div className="flex w-full items-center gap-2">
                  <Link
                    href={`/${workspace.slug}/systems/${systemSlug}/deployments/${r.slug}/releases`}
                    className="flex-grow truncate hover:text-blue-300"
                    title={r.name}
                  >
                    {r.name}
                  </Link>
                  <DeploymentOptionsDropdown {...r} />
                </div>
              </td>

              {environments.map((env, idx) => {
                return (
                  <td
                    key={env.id}
                    className={cn("h-[55px] w-[220px] px-4 py-2", {
                      "border-r": idx !== environments.length - 1,
                      "border-b": didx !== deployments.length - 1,
                    })}
                  >
                    <LazyDeploymentEnvironmentCell
                      environment={env}
                      deployment={r}
                      workspace={workspace}
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
