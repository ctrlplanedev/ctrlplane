"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type { Workspace } from "@ctrlplane/db/schema";
import Link from "next/link";
import { IconLoader2, IconRocket } from "@tabler/icons-react";

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
import { api } from "~/trpc/react";
import { DeploymentOptionsDropdown } from "../_components/deployments/dropdown/DeploymentOptionsDropdown";

type Environment = RouterOutputs["environment"]["bySystemId"][number];
type Deployment = RouterOutputs["deployment"]["bySystemId"][number];

const EnvHeader: React.FC<{
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
    <TableHead className="pl-6" key={env.id}>
      <Link href={envUrl}>
        <div className="flex items-center gap-2">
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
            <TableHead className="sticky left-0 z-10 rounded-tl-md py-4 pl-6 backdrop-blur-lg">
              Deployment
            </TableHead>
            {environments.map((env) => (
              <EnvHeader
                key={env.id}
                environment={env}
                workspaceSlug={workspace.slug}
                systemSlug={systemSlug}
              />
            ))}
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
                  "sticky left-0 z-10 h-[70px] w-[300px] max-w-[300px] backdrop-blur-lg",
                  idx === deployments.length - 1 && "rounded-b-md",
                )}
              >
                <div className="flex min-w-0 items-center justify-between gap-2 px-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-purple-400">
                      <IconRocket className="h-4 w-4 text-purple-600" />
                    </div>
                    <Link
                      href={`/${workspace.slug}/systems/${systemSlug}/deployments/${r.slug}/releases`}
                      className="truncate hover:text-blue-300"
                      title={r.name}
                    >
                      {r.name}
                    </Link>
                  </div>

                  <div className="shrink-0">
                    <DeploymentOptionsDropdown {...r} />
                  </div>
                </div>
              </TableCell>
              {environments.map((env) => {
                return (
                  <TableCell key={env.id} className="h-[70px] w-[250px]">
                    <div className="flex h-full w-full items-center justify-center">
                      <LazyDeploymentEnvironmentCell
                        environment={env}
                        deployment={r}
                        workspace={workspace}
                      />
                    </div>
                  </TableCell>
                );
              })}
              <TableCell className="flex-grow" />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default DeploymentTable;
