"use client";

import type { JobCondition } from "@ctrlplane/validators/jobs";
import React from "react";
import { IconFilter, IconLoader2 } from "@tabler/icons-react";
import _ from "lodash";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { JobStatusReadable } from "@ctrlplane/validators/jobs";

import { NoFilterMatch } from "~/app/[workspaceSlug]/(app)/_components/filter/NoFilterMatch";
import { JobConditionBadge } from "~/app/[workspaceSlug]/(app)/_components/job-condition/JobConditionBadge";
import { JobConditionDialog } from "~/app/[workspaceSlug]/(app)/_components/job-condition/JobConditionDialog";
import { useJobDrawer } from "~/app/[workspaceSlug]/(app)/_components/job-drawer/useJobDrawer";
import { JobLinksCell } from "~/app/[workspaceSlug]/(app)/_components/job-table/JobLinksCell";
import { VariableCell } from "~/app/[workspaceSlug]/(app)/_components/job-table/VariableCell";
import { JobTableStatusIcon } from "~/app/[workspaceSlug]/(app)/_components/JobTableStatusIcon";
import { useFilter } from "~/app/[workspaceSlug]/(app)/_components/useFilter";
import { api } from "~/trpc/react";

type JobTableProps = {
  workspaceId: string;
};

export const JobTable: React.FC<JobTableProps> = ({ workspaceId }) => {
  const { filter, setFilter } = useFilter<JobCondition>();
  const { setJobId } = useJobDrawer();
  const allReleaseJobTriggers = api.job.config.byWorkspaceId.list.useQuery(
    { workspaceId, limit: 0 },
    { refetchInterval: 60_000, placeholderData: (prev) => prev },
  );

  const releaseJobTriggers = api.job.config.byWorkspaceId.list.useQuery(
    { workspaceId, filter: filter ?? undefined, limit: 100 },
    { refetchInterval: 10_000, placeholderData: (prev) => prev },
  );

  return (
    <div className="h-full text-sm">
      <div className="flex h-[41px] items-center justify-between border-b border-neutral-800 p-1 px-2">
        <div className="flex items-center gap-2">
          <JobConditionDialog condition={filter} onChange={setFilter}>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="flex h-7 w-7 flex-shrink-0 items-center gap-1 text-xs"
              >
                <IconFilter className="h-4 w-4" />
              </Button>
              {filter != null && <JobConditionBadge condition={filter} />}
            </div>
          </JobConditionDialog>
          {!releaseJobTriggers.isLoading && releaseJobTriggers.isFetching && (
            <IconLoader2 className="h-4 w-4 animate-spin" />
          )}
        </div>

        {releaseJobTriggers.data?.total != null && (
          <div className="flex items-center gap-2 rounded-lg border border-neutral-800/50 px-2 py-1 text-sm text-muted-foreground">
            Total:
            <Badge
              variant="outline"
              className="rounded-full border-neutral-800 text-inherit"
            >
              {releaseJobTriggers.data.total}
            </Badge>
          </div>
        )}
      </div>

      {releaseJobTriggers.isLoading && (
        <div className="space-y-2 p-4">
          {_.range(10).map((i) => (
            <Skeleton
              key={i}
              className="h-9 w-full"
              style={{ opacity: 1 * (1 - i / 10) }}
            />
          ))}
        </div>
      )}
      {releaseJobTriggers.isSuccess && releaseJobTriggers.data.total === 0 && (
        <NoFilterMatch
          numItems={allReleaseJobTriggers.data?.total ?? 0}
          itemType="job"
          onClear={() => setFilter(null)}
        />
      )}

      {releaseJobTriggers.isSuccess && releaseJobTriggers.data.total > 0 && (
        <div className="h-[calc(100%-41px)] overflow-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>Resource</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Deployment</TableHead>
                <TableHead>Release Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Links</TableHead>
                <TableHead>Variables</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {releaseJobTriggers.data.items.map((job) => (
                <TableRow
                  key={job.id}
                  onClick={() => setJobId(job.job.id)}
                  className="cursor-pointer"
                >
                  <TableCell>{job.resource.name}</TableCell>
                  <TableCell>{job.environment.name}</TableCell>
                  <TableCell>{job.release.deployment.name}</TableCell>
                  <TableCell>{job.release.version}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <JobTableStatusIcon status={job.job.status} />
                      {JobStatusReadable[job.job.status]}
                    </div>
                  </TableCell>
                  <JobLinksCell
                    linksMetadata={job.job.metadata.find(
                      (m) => m.key === String(ReservedMetadataKey.Links),
                    )}
                  />
                  <VariableCell variables={job.job.variables} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
