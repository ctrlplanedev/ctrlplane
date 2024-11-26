"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";
import type { JobCondition, JobStatus } from "@ctrlplane/validators/jobs";
import React, { Fragment, useState } from "react";
import Link from "next/link";
import {
  IconChevronRight,
  IconDots,
  IconExternalLink,
  IconFilter,
} from "@tabler/icons-react";
import { capitalCase } from "change-case";
import { formatDistanceToNowStrict } from "date-fns";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@ctrlplane/ui/collapsible";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@ctrlplane/ui/table";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { JobStatusReadable } from "@ctrlplane/validators/jobs";

import { JobConditionBadge } from "~/app/[workspaceSlug]/(app)/_components/job-condition/JobConditionBadge";
import { JobConditionDialog } from "~/app/[workspaceSlug]/(app)/_components/job-condition/JobConditionDialog";
import { useJobDrawer } from "~/app/[workspaceSlug]/(app)/_components/job-drawer/useJobDrawer";
import { JobTableStatusIcon } from "~/app/[workspaceSlug]/(app)/_components/JobTableStatusIcon";
import { api } from "~/trpc/react";
import { useFilter } from "../../../../../../_components/useFilter";
import { JobDropdownMenu } from "./JobDropdownMenu";
import { PolicyApprovalRow } from "./PolicyApprovalRow";
import { useReleaseChannel } from "./useReleaseChannel";

type Trigger = RouterOutputs["job"]["config"]["byReleaseId"][number];

type CollapsibleTableRowProps = {
  environment: SCHEMA.Environment;
  environmentCount: number;
  deployment: SCHEMA.Deployment;
  release: {
    id: string;
    version: string;
    name: string;
  };
  triggersByTarget: Record<string, Trigger[]>;
};

const CollapsibleTableRow: React.FC<CollapsibleTableRowProps> = ({
  environment,
  environmentCount,
  deployment,
  release,
  triggersByTarget,
}) => {
  const { setJobId } = useJobDrawer();

  const approvalsQ = api.environment.policy.approval.byReleaseId.useQuery({
    releaseId: release.id,
  });

  const approvals = approvalsQ.data ?? [];
  const environmentApprovals = approvals.filter(
    (approval) => approval.policyId === environment.policyId,
  );

  const allTriggers = Object.values(triggersByTarget).flat();

  const isOpen = allTriggers.length < 10 && environmentCount < 3;
  const [isExpanded, setIsExpanded] = useState(isOpen);

  const [expandedTargets, setExpandedTargets] = useState<
    Record<string, boolean>
  >({});

  const switchTargetExpandedState = (targetId: string) =>
    setExpandedTargets((prev) => {
      const newState = { ...prev };
      const currentTargetState = newState[targetId] ?? false;
      newState[targetId] = !currentTargetState;
      return newState;
    });

  const { isPassingReleaseChannel, loading: releaseChannelLoading } =
    useReleaseChannel(deployment.id, environment.id, release.version);

  const loading = approvalsQ.isLoading || releaseChannelLoading;

  if (allTriggers.length === 0) return null;

  if (loading)
    return (
      <div className="space-y-2 p-4">
        {_.range(10).map((i) => (
          <Skeleton
            key={i}
            className="h-9 w-full"
            style={{ opacity: 1 * (1 - i / 10) }}
          />
        ))}
      </div>
    );

  return (
    <Fragment>
      <TableRow
        className={cn("sticky cursor-pointer bg-neutral-800/40")}
        onClick={() => setIsExpanded((t) => !t)}
      >
        <TableCell colSpan={7}>
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
                {Object.entries(
                  _.groupBy(allTriggers, (t) => t.job.status),
                ).map(([status, groupedTriggers]) => (
                  <Badge
                    key={status}
                    variant="outline"
                    className="rounded-full px-1.5 py-0.5"
                    title={JobStatusReadable[status as JobStatus]}
                  >
                    <JobTableStatusIcon status={status as JobStatus} />
                    <span className="pl-1">{groupedTriggers.length}</span>
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {environmentApprovals.map((approval) => (
                <PolicyApprovalRow
                  key={approval.id}
                  approval={approval}
                  environment={environment}
                />
              ))}
            </div>
          </div>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <>
          {Object.entries(triggersByTarget).map(([, triggers]) => {
            const resource = triggers[0]!.resource;
            const trigger = triggers[0]!; // triggers are already sorted by createdAt from the query
            const linksMetadata = trigger.job.metadata.find(
              (m) => m.key === String(ReservedMetadataKey.Links),
            )?.value;

            const links =
              linksMetadata != null
                ? (JSON.parse(linksMetadata) as Record<string, string>)
                : null;

            return (
              <Collapsible key={resource.id} asChild>
                <>
                  <TableRow
                    className="cursor-pointer border-none"
                    onClick={() => setJobId(trigger.job.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {triggers.length > 1 && (
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() =>
                                switchTargetExpandedState(resource.id)
                              }
                            >
                              <IconChevronRight
                                className={cn(
                                  "h-3 w-3 text-muted-foreground transition-all",
                                  expandedTargets[resource.id] && "rotate-90",
                                )}
                              />
                            </Button>
                            {resource.name}
                          </div>
                        </CollapsibleTrigger>
                      )}

                      {triggers.length === 1 && (
                        <div className="pl-[29px]">{resource.name}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <JobTableStatusIcon status={trigger.job.status} />
                        {capitalCase(trigger.job.status)}
                      </div>
                    </TableCell>
                    <TableCell>{trigger.type}</TableCell>
                    <TableCell>
                      {trigger.job.externalId != null ? (
                        <code className="font-mono text-xs">
                          {trigger.job.externalId}
                        </code>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No external ID
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      onClick={(e) => e.stopPropagation()}
                      className="py-0"
                    >
                      {links != null && (
                        <div className="flex items-center gap-1">
                          {Object.entries(links).map(([label, url]) => (
                            <Link
                              key={label}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={buttonVariants({
                                variant: "secondary",
                                size: "xs",
                                className: "gap-1",
                              })}
                            >
                              <IconExternalLink className="h-4 w-4" />
                              {label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="flex-shrink-0 text-xs text-muted-foreground hover:bg-secondary"
                      >
                        {formatDistanceToNowStrict(trigger.createdAt, {
                          addSuffix: true,
                        })}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end">
                        <JobDropdownMenu
                          release={release}
                          deployment={deployment}
                          target={trigger.resource}
                          environmentId={trigger.environmentId}
                          job={{
                            id: trigger.job.id,
                            status: trigger.job.status,
                          }}
                          isPassingReleaseChannel={isPassingReleaseChannel}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                          >
                            <IconDots className="h-4 w-4" />
                          </Button>
                        </JobDropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                  <CollapsibleContent asChild>
                    <>
                      {triggers.map((trigger, idx) => {
                        if (idx === 0) return null;
                        const linksMetadata = trigger.job.metadata.find(
                          (m) => m.key === String(ReservedMetadataKey.Links),
                        )?.value;

                        const links =
                          linksMetadata != null
                            ? (JSON.parse(linksMetadata) as Record<
                                string,
                                string
                              >)
                            : null;

                        return (
                          <TableRow
                            key={trigger.id}
                            className="cursor-pointer border-none"
                            onClick={() => setJobId(trigger.job.id)}
                          >
                            <TableCell className="p-0">
                              <div className="pl-5">
                                <div className="h-10 border-l border-neutral-700/50" />
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <JobTableStatusIcon
                                  status={trigger.job.status}
                                />
                                {capitalCase(trigger.job.status)}
                              </div>
                            </TableCell>
                            <TableCell>{trigger.type}</TableCell>
                            <TableCell>
                              {trigger.job.externalId != null ? (
                                <code className="font-mono text-xs">
                                  {trigger.job.externalId}
                                </code>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  No external ID
                                </span>
                              )}
                            </TableCell>
                            <TableCell
                              onClick={(e) => e.stopPropagation()}
                              className="py-0"
                            >
                              {links != null && (
                                <div className="flex items-center gap-1">
                                  {Object.entries(links).map(([label, url]) => (
                                    <Link
                                      key={label}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={buttonVariants({
                                        variant: "secondary",
                                        size: "xs",
                                        className: "gap-1",
                                      })}
                                    >
                                      <IconExternalLink className="h-4 w-4" />
                                      {label}
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className="flex-shrink-0 text-xs text-muted-foreground hover:bg-secondary"
                              >
                                {formatDistanceToNowStrict(trigger.createdAt, {
                                  addSuffix: true,
                                })}
                              </Badge>
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end">
                                <JobDropdownMenu
                                  release={release}
                                  deployment={deployment}
                                  target={trigger.resource}
                                  environmentId={trigger.environmentId}
                                  job={{
                                    id: trigger.job.id,
                                    status: trigger.job.status,
                                  }}
                                  isPassingReleaseChannel={
                                    isPassingReleaseChannel
                                  }
                                >
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                  >
                                    <IconDots className="h-4 w-4" />
                                  </Button>
                                </JobDropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </>
                  </CollapsibleContent>
                </>
              </Collapsible>
            );
          })}
        </>
      )}
    </Fragment>
  );
};

type TargetReleaseTableProps = {
  release: { id: string; version: string; name: string };
  deployment: SCHEMA.Deployment;
  environments: SCHEMA.Environment[];
};

export const TargetReleaseTable: React.FC<TargetReleaseTableProps> = ({
  release,
  deployment,
  environments,
}) => {
  const { filter, setFilter } = useFilter<JobCondition>();
  const releaseJobTriggerQuery = api.job.config.byReleaseId.useQuery(
    { releaseId: release.id, filter: filter ?? undefined },
    { refetchInterval: 5_000 },
  );
  const releaseJobTriggers = releaseJobTriggerQuery.data ?? [];
  const groupedTriggers = _.chain(releaseJobTriggers)
    .groupBy((t) => t.environmentId)
    .map((triggers) => ({
      environment: environments.find(
        (e) => e.id === triggers[0]!.environmentId,
      ),
      targets: _.groupBy(triggers, (t) => t.resource.id),
    }))
    .filter((t) => isPresent(t.environment))
    .value();

  return (
    <>
      <div className="flex items-center justify-between border-b border-neutral-800 p-1 px-2">
        <JobConditionDialog condition={filter ?? null} onChange={setFilter}>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <IconFilter className="h-4 w-4" />
            </Button>
            {filter != null && <JobConditionBadge condition={filter} />}
          </div>
        </JobConditionDialog>
      </div>

      {releaseJobTriggerQuery.isLoading && (
        <div className="space-y-2 p-4">
          {_.range(30).map((i) => (
            <Skeleton
              key={i}
              className="h-9 w-full"
              style={{ opacity: 1 * (1 - i / 10) }}
            />
          ))}
        </div>
      )}

      {!releaseJobTriggerQuery.isLoading && releaseJobTriggers.length === 0 && (
        <div className="flex w-full items-center justify-center py-8">
          <span className="text-sm text-muted-foreground">
            No jobs found for this release
          </span>
        </div>
      )}

      {!releaseJobTriggerQuery.isLoading && releaseJobTriggers.length > 0 && (
        <Table className="table-fixed">
          <TableBody>
            {groupedTriggers.map(({ environment, targets }) => (
              <CollapsibleTableRow
                key={environment!.id}
                environment={environment!}
                environmentCount={groupedTriggers.length}
                deployment={deployment}
                release={release}
                triggersByTarget={targets}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
};
