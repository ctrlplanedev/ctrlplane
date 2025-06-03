"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import { IconChevronRight } from "@tabler/icons-react";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { TableCell } from "@ctrlplane/ui/table";

import { JobTableStatusIcon } from "~/app/[workspaceSlug]/(app)/_components/job/JobTableStatusIcon";

const JobStatusBadge: React.FC<{
  status: SCHEMA.JobStatus;
  count?: number;
}> = ({ status, count = 0 }) => (
  <Badge variant="outline" className="rounded-full px-1.5 py-0.5">
    <JobTableStatusIcon status={status} />
    <span className="pl-1">{count}</span>
  </Badge>
);

export const EnvironmentTableRow: React.FC<{
  isExpanded: boolean;
  deployment: { id: string };
  environment: { name: string };
  releaseTargets: Array<{
    id: string;
    resourceId: string;
    jobs: { status: SCHEMA.JobStatus; id: string }[];
  }>;
}> = ({ isExpanded, environment, releaseTargets }) => {
  const statusCounts = _.chain(releaseTargets)
    .map((target) => target.jobs[0])
    .filter(isPresent)
    .countBy((job) => job.status)
    .value();

  return (
    <TableCell colSpan={5} className="bg-neutral-800/40">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <IconChevronRight
            className={cn(
              "h-3 w-3 text-muted-foreground transition-all",
              isExpanded && "rotate-90",
            )}
          />
          {environment.name}
          <div className="flex items-center gap-1.5">
            {Object.entries(statusCounts).map(([status, count]) => (
              <JobStatusBadge
                key={status}
                status={status as SCHEMA.JobStatus}
                count={count}
              />
            ))}
          </div>
        </div>
      </div>
    </TableCell>
  );
};
