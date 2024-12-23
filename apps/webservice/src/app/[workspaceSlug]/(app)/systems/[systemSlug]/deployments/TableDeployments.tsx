"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type { Deployment, Workspace } from "@ctrlplane/db/schema";
import Link from "next/link";
import { IconCircleFilled, IconLoader2 } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";

import { DeploymentOptionsDropdown } from "~/app/[workspaceSlug]/(app)/_components/DeploymentOptionsDropdown";
import { api } from "~/trpc/react";
import { LazyReleaseEnvironmentCell } from "./ReleaseEnvironmentCell";

type Environment = RouterOutputs["environment"]["bySystemId"][number];

const Icon: React.FC<{ children?: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <th
    className={cn(
      "sticky left-0 p-2 px-3 text-left text-sm font-normal text-muted-foreground",
      className,
    )}
  >
    {children}
  </th>
);

const EnvIcon: React.FC<{
  isFirst?: boolean;
  isLast?: boolean;
  environment: Environment;
  workspaceSlug: string;
  systemSlug: string;
}> = ({ environment: env, isFirst, isLast, workspaceSlug, systemSlug }) => {
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
    <Icon
      key={env.id}
      className={cn(
        "border-x border-t border-neutral-800/30 hover:bg-neutral-800/20",
        isFirst && "rounded-tl-md",
        isLast && "rounded-tr-md",
      )}
    >
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
      }> | null;
    }
  >;
}> = ({ systemSlug, deployments, environments, workspace }) => {
  return (
    <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 w-full overflow-x-auto">
      <table className="w-full min-w-max border-separate border-spacing-0">
        <thead>
          <tr>
            <Icon className="sticky left-0 z-10 backdrop-blur-lg" />
            {environments.map((env, idx) => (
              <EnvIcon
                key={env.id}
                environment={env}
                isFirst={idx === 0}
                isLast={idx === environments.length - 1}
                workspaceSlug={workspace.slug}
                systemSlug={systemSlug}
              />
            ))}
          </tr>
        </thead>

        <tbody>
          {deployments.map((r, idx) => (
            <tr key={r.id} className="bg-neutral-800/10">
              <td
                className={cn(
                  "sticky left-0 z-10 min-w-[500px] backdrop-blur-lg",
                  "items-center border-b border-l px-4 text-lg",
                  idx === 0 && "rounded-tl-md border-t",
                  idx === deployments.length - 1 && "rounded-bl-md",
                )}
              >
                <div className="flex w-full items-center gap-2">
                  <div className="relative h-[25px] w-[25px]">
                    <IconCircleFilled className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-green-300/20" />
                    <IconCircleFilled className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-green-300" />
                  </div>
                  <Link
                    href={`/${workspace.slug}/systems/${systemSlug}/deployments/${r.slug}/releases`}
                    className="flex-grow hover:text-blue-300"
                  >
                    {r.name}
                  </Link>
                  <DeploymentOptionsDropdown {...r} />
                </div>
              </td>

              {environments.map((env, envIdx) => {
                const release =
                  r.activeReleases?.find((r) => r.environmentId === env.id) ??
                  null;
                return (
                  <td
                    key={env.id}
                    className={cn(
                      "h-[55px] w-[220px] border-x border-b border-neutral-800 border-x-neutral-800/30 p-2 px-3",
                      envIdx === environments.length - 1 &&
                        "border-r-neutral-800",
                      idx === 0 && "border-t",
                    )}
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
