"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type { JobCondition } from "@ctrlplane/validators/jobs";
import { IconFilter, IconLoader2 } from "@tabler/icons-react";
import { formatDistanceToNowStrict } from "date-fns";
import _ from "lodash";

import { Badge } from "@ctrlplane/ui/badge";
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
import { JobStatusReadable } from "@ctrlplane/validators/jobs";

import { NoFilterMatch } from "~/app/[workspaceSlug]/(app)/_components/filter/NoFilterMatch";
import { JobConditionBadge } from "~/app/[workspaceSlug]/(app)/_components/job-condition/JobConditionBadge";
import { RunbookJobConditionDialog } from "~/app/[workspaceSlug]/(app)/_components/job-condition/RunbookJobConditionDialog";
import { JobTableStatusIcon } from "~/app/[workspaceSlug]/(app)/_components/JobTableStatusIcon";
import { useFilter } from "~/app/[workspaceSlug]/(app)/_components/useFilter";
import { api } from "~/trpc/react";

type VariableCellProps = {
  variables: SCHEMA.JobVariable[];
};

const VariableCell: React.FC<VariableCellProps> = ({ variables }) => {
  return (
    <TableCell className="py-0">
      {variables.length > 0 && (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button variant="secondary" size="sm" className="h-6 px-2 py-0">
              {variables.length} variables
            </Button>
          </HoverCardTrigger>
          <HoverCardContent
            align="center"
            className="flex max-w-60 flex-col gap-1 p-2"
          >
            {variables.map((v) => (
              <div key={v.id} className="text-xs">
                {v.key}: {String(v.value)}
              </div>
            ))}
          </HoverCardContent>
        </HoverCard>
      )}
    </TableCell>
  );
};

export default function RunbookPage({
  params,
}: {
  params: { runbookId: string };
}) {
  const { filter, setFilter } = useFilter<JobCondition>();
  const { data: allRunbookJobs } = api.runbook.jobs.useQuery({
    runbookId: params.runbookId,
    limit: 0,
  });

  const { runbookId } = params;
  const { data: runbookJobs, ...runbookJobsQ } = api.runbook.jobs.useQuery(
    { runbookId, filter: filter ?? undefined, limit: 100 },
    { refetchInterval: 10_000, placeholderData: (prev) => prev },
  );

  return (
    <div className="h-full text-sm">
      <div className="flex h-[41px] items-center justify-between border-b border-neutral-800 p-1 px-2">
        <div className="flex items-center gap-2">
          <RunbookJobConditionDialog condition={filter} onChange={setFilter}>
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
          </RunbookJobConditionDialog>
          {!runbookJobsQ.isLoading && runbookJobsQ.isFetching && (
            <IconLoader2 className="h-4 w-4 animate-spin" />
          )}
        </div>

        {runbookJobs?.total != null && (
          <div className="flex items-center gap-2 rounded-lg border border-neutral-800/50 px-2 py-1 text-sm text-muted-foreground">
            Total:
            <Badge
              variant="outline"
              className="rounded-full border-neutral-800 text-inherit"
            >
              {runbookJobs.total}
            </Badge>
          </div>
        )}
      </div>

      {runbookJobsQ.isLoading && (
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
      {runbookJobsQ.isSuccess && runbookJobs?.total === 0 && (
        <NoFilterMatch
          numItems={allRunbookJobs?.total ?? 0}
          itemType="job"
          onClear={() => setFilter(null)}
        />
      )}

      {runbookJobsQ.isSuccess &&
        runbookJobs != null &&
        runbookJobs.items.length > 0 && (
          <div className="h-[calc(100%-41px)] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Variables</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runbookJobs.items.map((job) => (
                  <TableRow key={job.job.id} className="cursor-pointer">
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <JobTableStatusIcon status={job.job.status} />
                        {JobStatusReadable[job.job.status]}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNowStrict(job.job.createdAt, {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <VariableCell variables={job.job.variables} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
    </div>
  );
}