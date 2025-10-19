"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import Link from "next/link";
import { IconDotsVertical, IconLoader2 } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { DeploymentOptionsDropdown } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployments/dropdown/DeploymentOptionsDropdown";
import { LazyDeploymentEnvironmentCell } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployments/environment-cell/DeploymentEnvironmentCell";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import {
  SystemDeploymentSkeleton,
  SystemTableSkeleton,
} from "./SystemDeploymentSkeleton";

const EnvHeader: React.FC<{
  systemSlug: string;
  environment: SCHEMA.Environment;
  workspace: SCHEMA.Workspace;
}> = ({ systemSlug, environment: env, workspace }) => {
  const { data, isLoading } = api.environment.resources.useQuery(env.id);
  const total = data?.length ?? 0;

  const systemUrls = urls.workspace(workspace.slug).system(systemSlug);
  const envUrl = systemUrls.environment(env.id).baseUrl();
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

const DeploymentNameCell: React.FC<{
  deployment: SCHEMA.Deployment;
  workspaceSlug: string;
  systemSlug: string;
  className?: string;
}> = ({ deployment, workspaceSlug, systemSlug, className }) => {
  return (
    <TableCell
      className={cn(
        "sticky left-0 z-10 h-[70px] w-[350px] max-w-[300px] backdrop-blur-lg",
        className,
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-2 px-2 text-lg">
        <Link
          href={urls
            .workspace(workspaceSlug)
            .system(systemSlug)
            .deployment(deployment.slug)
            .baseUrl()}
          className="truncate hover:text-blue-300"
          title={deployment.name}
        >
          {deployment.name}
        </Link>
        <DeploymentOptionsDropdown {...deployment}>
          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0">
            <IconDotsVertical className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DeploymentOptionsDropdown>
      </div>
    </TableCell>
  );
};

type System = SCHEMA.System & { deployments: SCHEMA.Deployment[] };

const DeploymentTable: React.FC<{
  workspace: SCHEMA.Workspace;
  system: System;
}> = ({ workspace, system }) => {
  const { data: environments, isLoading } = api.environment.bySystemId.useQuery(
    system.id,
  );

  const { deployments } = system;

  if (isLoading)
    return <SystemDeploymentSkeleton table={<SystemTableSkeleton />} />;

  return (
    <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 w-full overflow-x-auto">
      <Table className="w-full min-w-max bg-background">
        <TableHeader className="[&_tr]:border-0">
          <TableRow className="hover:bg-transparent">
            <TableHead className="sticky left-0 z-10 w-[350px] rounded-md py-4 pl-6 backdrop-blur-lg">
              Deployments
            </TableHead>
            {environments?.map((env) => (
              <EnvHeader
                key={env.id}
                systemSlug={system.slug}
                environment={env}
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
              <DeploymentNameCell
                deployment={r}
                workspaceSlug={workspace.slug}
                systemSlug={system.slug}
                className={
                  idx === deployments.length - 1 ? "rounded-b-md" : undefined
                }
              />
              {environments?.map((env) => (
                <TableCell key={env.id} className="h-[70px] w-[220px]">
                  <LazyDeploymentEnvironmentCell
                    environment={env}
                    deployment={r}
                    system={system}
                  />
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
