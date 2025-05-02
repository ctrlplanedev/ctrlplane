"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";
import type { JobCondition } from "@ctrlplane/validators/jobs";
import React, { Fragment, useState } from "react";
import Link from "next/link";
import {
  IconChevronRight,
  IconDots,
  IconExternalLink,
  IconFilter,
  IconMenu2,
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
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@ctrlplane/ui/table";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { JobConditionBadge } from "~/app/[workspaceSlug]/(app)/_components/job/condition/JobConditionBadge";
import { JobConditionDialog } from "~/app/[workspaceSlug]/(app)/_components/job/condition/JobConditionDialog";
import { useJobDrawer } from "~/app/[workspaceSlug]/(app)/_components/job/drawer/useJobDrawer";
import { JobDropdownMenu } from "~/app/[workspaceSlug]/(app)/_components/job/JobDropdownMenu";
import { JobTableStatusIcon } from "~/app/[workspaceSlug]/(app)/_components/job/JobTableStatusIcon";
import { useDeploymentVersionChannel } from "~/app/[workspaceSlug]/(app)/_hooks/channel/useDeploymentVersionChannel";
import { useCondition } from "~/app/[workspaceSlug]/(app)/_hooks/useCondition";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/react";
import { EnvironmentApprovalRow } from "./EnvironmentApprovalRow";
import { EnvironmentRowDropdown } from "./EnvironmentRowDropdown";

type Trigger = RouterOutputs["job"]["config"]["byDeploymentVersionId"][number];

type CollapsibleTableRowProps = {
  environment: SCHEMA.Environment;
  environmentCount: number;
  deployment: SCHEMA.Deployment;
  deploymentVersion: {
    id: string;
    tag: string;
    name: string;
    deploymentId: string;
  };
  triggersByResource: Record<string, Trigger[]>;
};

const CollapsibleTableRow: React.FC<CollapsibleTableRowProps> = ({
  environment,
  environmentCount,
  deployment,
  deploymentVersion,
  triggersByResource,
}) => {
  const { setJobId } = useJobDrawer();

  const approvalsQ =
    api.environment.policy.approval.byDeploymentVersionId.useQuery({
      versionId: deploymentVersion.id,
    });

  const approvals = approvalsQ.data ?? [];
  const environmentApprovals = approvals.filter(
    (a) => a.policyId === environment.policyId,
  );

  const allTriggers = Object.values(triggersByResource).flat();
  const latestJobsByResource = Object.entries(triggersByResource).map(
    ([_, triggers]) => {
      const sortedByCreatedAt = triggers.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      return sortedByCreatedAt[sortedByCreatedAt.length - 1]!.job;
    },
  );
  const latestStatusesByResource = latestJobsByResource.map((j) => j.status);

  const sortedAndGroupedTriggers = Object.entries(triggersByResource)
    .sort(([_, a], [__, b]) =>
      a[0]!.resource.name.localeCompare(b[0]!.resource.name),
    )
    .map(([, triggers]) =>
      triggers.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    )
    .sort((a, b) => {
      if (
        a[0]!.job.status === JobStatus.Failure &&
        b[0]!.job.status !== JobStatus.Failure
      )
        return -1;

      if (
        a[0]!.job.status !== JobStatus.Failure &&
        b[0]!.job.status === JobStatus.Failure
      )
        return 1;

      return a[0]!.job.status.localeCompare(b[0]!.job.status);
    });

  const statusCounts = _.chain(latestStatusesByResource)
    .groupBy((s) => s)
    .map((groupedStatuses) => ({
      status: groupedStatuses[0]!,
      count: groupedStatuses.length,
    }))
    .value();

  const isOpen = allTriggers.length < 10 && environmentCount < 3;
  const [isExpanded, setIsExpanded] = useState(isOpen);

  const [expandedResources, setExpandedResources] = useState<
    Record<string, boolean>
  >({});

  const switchResourceExpandedState = (resourceId: string) =>
    setExpandedResources((prev) => {
      const newState = { ...prev };
      const currentResourceState = newState[resourceId] ?? false;
      newState[resourceId] = !currentResourceState;
      return newState;
    });

  const {
    isPassingDeploymentVersionChannel,
    loading: deploymentVersionChannelLoading,
  } = useDeploymentVersionChannel(
    deployment.id,
    environment.id,
    deploymentVersion.tag,
  );

  const loading = approvalsQ.isLoading || deploymentVersionChannelLoading;

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
                {statusCounts.map(({ status, count }) => (
                  <Badge
                    key={status}
                    variant="outline"
                    className="rounded-full px-1.5 py-0.5"
                  >
                    <JobTableStatusIcon status={status} />
                    <span className="pl-1">{count}</span>
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {environmentApprovals.map((approval) => (
                <EnvironmentApprovalRow
                  key={approval.id}
                  approval={approval}
                  deploymentVersion={deploymentVersion}
                />
              ))}

              <EnvironmentRowDropdown
                jobIds={latestJobsByResource.map((j) => j.id)}
              >
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <IconDots className="h-4 w-4" />
                </Button>
              </EnvironmentRowDropdown>
            </div>
          </div>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <>
          {sortedAndGroupedTriggers.map((triggers) => {
            const latestTrigger = triggers[0]!;
            const { resource, job } = latestTrigger;
            const trigger = triggers[0]!;
            const linksMetadata = job.metadata[ReservedMetadataKey.Links];

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
                                switchResourceExpandedState(resource.id)
                              }
                            >
                              <IconChevronRight
                                className={cn(
                                  "h-3 w-3 text-muted-foreground transition-all",
                                  expandedResources[resource.id] && "rotate-90",
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
                          deployment={deployment}
                          resource={trigger.resource}
                          environmentId={trigger.environmentId}
                          job={{
                            id: trigger.job.id,
                            status: trigger.job.status,
                          }}
                          isPassingDeploymentVersionChannel={
                            isPassingDeploymentVersionChannel
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
                  <CollapsibleContent asChild>
                    <>
                      {triggers.map((trigger, idx) => {
                        if (idx === 0) return null;
                        const linksMetadata =
                          trigger.job.metadata[ReservedMetadataKey.Links];

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
                                  deployment={deployment}
                                  resource={trigger.resource}
                                  environmentId={trigger.environmentId}
                                  job={{
                                    id: trigger.job.id,
                                    status: trigger.job.status,
                                  }}
                                  isPassingDeploymentVersionChannel={
                                    isPassingDeploymentVersionChannel
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

type ResourceReleaseTableProps = {
  deploymentVersion: {
    id: string;
    tag: string;
    name: string;
    deploymentId: string;
  };
  deployment: SCHEMA.Deployment;
  environments: SCHEMA.Environment[];
};

export const ResourceReleaseTable: React.FC<ResourceReleaseTableProps> = ({
  deploymentVersion,
  deployment,
  environments,
}) => {
  const { condition, setCondition } = useCondition<JobCondition>();
  const releaseJobTriggerQuery = api.job.config.byDeploymentVersionId.useQuery(
    { versionId: deploymentVersion.id, condition: condition ?? undefined },
    { refetchInterval: 5_000 },
  );
  const releaseJobTriggers = releaseJobTriggerQuery.data ?? [];
  const groupedTriggers = _.chain(releaseJobTriggers)
    .groupBy((t) => t.environmentId)
    .map((triggers) => ({
      environment: environments.find(
        (e) => e.id === triggers[0]!.environmentId,
      ),
      resources: _.groupBy(triggers, (t) => t.resource.id),
    }))
    .filter((t) => isPresent(t.environment))
    .sort((a, b) =>
      a.environment!.name.localeCompare(b.environment!.name, undefined, {
        sensitivity: "accent",
      }),
    )
    .value();

  return (
    <>
      <div className="flex items-center border-b border-neutral-800 p-1 px-2">
        <SidebarTrigger name={Sidebars.Release}>
          <IconMenu2 className="h-4 w-4" />
        </SidebarTrigger>
        <JobConditionDialog condition={condition} onChange={setCondition}>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <IconFilter className="h-4 w-4" />
            </Button>
            {condition != null && <JobConditionBadge condition={condition} />}
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
            No jobs found for this version
          </span>
        </div>
      )}

      {!releaseJobTriggerQuery.isLoading && releaseJobTriggers.length > 0 && (
        <Table>
          <TableBody>
            {groupedTriggers.map(({ environment, resources }) => (
              <CollapsibleTableRow
                key={environment!.id}
                environment={environment!}
                environmentCount={groupedTriggers.length}
                deployment={deployment}
                deploymentVersion={deploymentVersion}
                triggersByResource={resources}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
};
