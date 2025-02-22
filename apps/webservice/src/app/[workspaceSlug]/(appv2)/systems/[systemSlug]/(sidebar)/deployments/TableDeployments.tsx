"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type { Deployment, Workspace } from "@ctrlplane/db/schema";
import type { ReleaseStatusType } from "@ctrlplane/validators/releases";
import Link from "next/link";
import { IconLoader2 } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";

import { LazyReleaseEnvironmentCell } from "~/app/[workspaceSlug]/(appv2)/systems/[systemSlug]/_components/release-cell/ReleaseEnvironmentCell";
import { api } from "~/trpc/react";
import { DeploymentOptionsDropdown } from "./DeploymentOptionsDropdown";

type Environment = RouterOutputs["environment"]["bySystemId"][number];

const Icon: React.FC<{ children?: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <th
    className={cn(
      "sticky left-0 h-10 border-b border-r p-2 px-3 text-left text-sm font-normal text-muted-foreground",
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
}> = ({ environment: env, workspaceSlug, systemSlug }) => {
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
    <Icon key={env.id}>
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
  environments: Environment[];
  deployments: Array<
    Deployment & {
      activeReleases: Array<{
        id: string;
        name: string;
        version: string;
        createdAt: Date;
        environmentId: string;
        status: ReleaseStatusType;
      }> | null;
    }
  >;
}> = ({ systemSlug, deployments, environments, workspace }) => {
  return (
    <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 w-full overflow-x-auto">
      <table className="w-full min-w-max border-separate border-spacing-0">
        <thead>
          <tr>
            <Icon className="sticky left-0 z-10 backdrop-blur-lg">
              Deployment
            </Icon>
            {environments.map((env) => (
              <EnvIcon
                key={env.id}
                environment={env}
                workspaceSlug={workspace.slug}
                systemSlug={systemSlug}
              />
            ))}
          </tr>
        </thead>

        <tbody>
          {deployments.map((r) => (
            <tr key={r.id} className="bg-background">
              <td className="sticky left-0 z-10 min-w-[500px] items-center border-b border-r px-4 backdrop-blur-lg">
                <div className="flex w-full items-center gap-2">
                  <Link
                    href={`/${workspace.slug}/systems/${systemSlug}/deployments/${r.slug}/releases`}
                    className="flex-grow hover:text-blue-300"
                  >
                    {r.name}
                  </Link>
                  <DeploymentOptionsDropdown {...r} />
                </div>
              </td>

              {environments.map((env) => {
                const release =
                  r.activeReleases?.find((r) => r.environmentId === env.id) ??
                  null;
                return (
                  <td
                    key={env.id}
                    className="h-[55px] w-[220px] border-b border-r px-4 py-2"
                  >
                    {release != null && (
                      <LazyReleaseEnvironmentCell
                        release={release}
                        environment={env}
                        deployment={r}
                      />
                    )}
                    {release == null && (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        No release
                      </div>
                    )}
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
