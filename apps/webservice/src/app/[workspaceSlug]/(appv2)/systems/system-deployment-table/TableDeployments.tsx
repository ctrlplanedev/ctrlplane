"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type { Workspace } from "@ctrlplane/db/schema";
import Link from "next/link";
import { IconLoader2 } from "@tabler/icons-react";

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

import { LazyDeploymentEnvironmentCell } from "~/app/[workspaceSlug]/(appv2)/systems/[systemSlug]/_components/deployments/environment-cell/DeploymentEnvironmentCell";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

type Environment = RouterOutputs["environment"]["bySystemId"][number];
type Deployment = RouterOutputs["deployment"]["bySystemId"][number];

const EnvHeader: React.FC<{
  environment: Environment;
  workspaceSlug: string;
}> = ({ environment: env, workspaceSlug }) => {
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

  const envUrl = `/${workspaceSlug}/systems?environment_id=${env.id}`;
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

const DeploymentTable: React.FC<{
  workspace: Workspace;
  systemSlug: string;
  environments: Environment[];
  deployments: Deployment[];
}> = ({ systemSlug, deployments, environments, workspace }) => {
  return (
    <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 w-full overflow-x-auto">
      <Table className="w-full min-w-max bg-background">
        <TableHeader className="[&_tr]:border-0">
          <TableRow className="hover:bg-transparent">
            <TableHead className="sticky left-0 z-10 w-[350px] rounded-tl-md py-4 pl-6 backdrop-blur-lg">
              Deployments
            </TableHead>
            {environments.map((env) => (
              <EnvHeader
                key={env.id}
                environment={env}
                workspaceSlug={workspace.slug}
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
