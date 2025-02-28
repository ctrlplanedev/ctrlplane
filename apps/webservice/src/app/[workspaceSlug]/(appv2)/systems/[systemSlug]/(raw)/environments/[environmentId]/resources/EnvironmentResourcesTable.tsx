import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrlplane/ui/hover-card";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { useDeploymentEnvResourceDrawer } from "~/app/[workspaceSlug]/(appv2)/_components/deployments/resource-drawer/useDeploymentResourceDrawer";
import { JobTableStatusIcon } from "~/app/[workspaceSlug]/(appv2)/_components/job/JobTableStatusIcon";
import { api } from "~/trpc/react";

type HealthCellProps = {
  resourceId: string;
  environmentId: string;
  systemId: string;
};
const HealthCell: React.FC<HealthCellProps> = ({
  resourceId,
  systemId,
  environmentId,
}) => {
  const { setDeploymentEnvResourceId } = useDeploymentEnvResourceDrawer();

  const { data, isLoading } =
    api.resource.stats.health.byResourceAndSystem.useQuery({
      resourceId,
      systemId,
    });

  const jobs = data ?? [];

  if (isLoading) return;
  <div className="flex items-center gap-2">
    <Skeleton className="h-2 w-2 rounded-full" />;
    <Skeleton className="h-4 w-20 rounded-full" />;
  </div>;

  if (jobs.length === 0)
    return (
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded-full bg-muted" />
        <div className="text-muted-foreground">No jobs</div>
      </div>
    );

  const numHealthy = jobs.filter(
    (job) => job.status === JobStatus.Successful,
  ).length;

  const isHealthy = numHealthy === jobs.length;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="flex w-fit cursor-default items-center gap-2 rounded-md px-2 py-1 hover:bg-secondary/50">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              isHealthy ? "bg-green-500" : "bg-red-500",
            )}
          />
          <div className="text-muted-foreground">
            {numHealthy} / {jobs.length} Healthy
          </div>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-fit p-2">
        <div className="space-y-2">
          {jobs.map((job) => (
            <Button
              key={job.id}
              variant="ghost"
              className="grid w-full grid-cols-3 gap-4"
              onClick={() =>
                setDeploymentEnvResourceId(
                  job.deployment.id,
                  environmentId,
                  resourceId,
                )
              }
            >
              <div className="col-span-1 text-left">{job.deployment.name}</div>
              <div className="col-span-1 text-left">{job.release.version}</div>
              <div className="col-span-1 flex items-center gap-2">
                <JobTableStatusIcon status={job.status} />
                <span className="text-muted-foreground"> {job.status}</span>
              </div>
            </Button>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

type EnvironmentResourceTableProps = {
  resources: SCHEMA.Resource[];
  systemId: string;
  environmentId: string;
};

export const EnvironmentResourceTable: React.FC<
  EnvironmentResourceTableProps
> = ({ resources, systemId, environmentId }) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Resource</TableHead>
        <TableHead>Health</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {resources.map((resource) => (
        <TableRow key={resource.id} className="hover:bg-transparent">
          <TableCell>{resource.name}</TableCell>
          <TableCell>
            <HealthCell
              resourceId={resource.id}
              systemId={systemId}
              environmentId={environmentId}
            />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);
