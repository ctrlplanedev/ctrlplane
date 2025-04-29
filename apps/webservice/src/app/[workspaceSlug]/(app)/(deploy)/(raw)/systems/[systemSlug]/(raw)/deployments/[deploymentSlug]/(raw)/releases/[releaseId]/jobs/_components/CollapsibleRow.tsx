import type * as SCHEMA from "@ctrlplane/db/schema";
import type { JobStatus } from "@ctrlplane/validators/jobs";
import { useState } from "react";
import Link from "next/link";
import {
  IconChevronRight,
  IconDots,
  IconExternalLink,
} from "@tabler/icons-react";
import { capitalCase } from "change-case";
import { formatDistanceToNowStrict } from "date-fns";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@ctrlplane/ui/collapsible";
import { TableCell, TableRow } from "@ctrlplane/ui/table";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { useJobDrawer } from "~/app/[workspaceSlug]/(app)/_components/job/drawer/useJobDrawer";
import { JobDropdownMenu } from "~/app/[workspaceSlug]/(app)/_components/job/JobDropdownMenu";
import { JobTableStatusIcon } from "~/app/[workspaceSlug]/(app)/_components/job/JobTableStatusIcon";
import { useDeploymentVersionChannel } from "~/app/[workspaceSlug]/(app)/_hooks/channel/useDeploymentVersionChannel";
import { EnvironmentRowDropdown } from "../../jobs/release-table/EnvironmentRowDropdown";

type ReleaseTarget = SCHEMA.ReleaseTarget & {
  jobs: {
    id: string;
    metadata: Record<string, string>;
    type: string;
    status: SCHEMA.JobStatus;
    externalId?: string;
    createdAt?: Date;
  }[];
  resource: SCHEMA.Resource;
};

type Environment = SCHEMA.Environment & {
  releaseTargets: ReleaseTarget[];
  statusCounts: { status: SCHEMA.JobStatus; count: number }[];
};

type CollapsibleRowProps = {
  environment: Environment;
  deployment: SCHEMA.Deployment;
  deploymentVersion: {
    id: string;
    tag: string;
    name: string;
    deploymentId: string;
  };
};

export const CollapsibleRow: React.FC<CollapsibleRowProps> = ({
  environment,
  deployment,
  deploymentVersion,
}) => {
  const { setJobId } = useJobDrawer();

  const [isExpanded, setIsExpanded] = useState(false);

  const [expandedResources, setExpandedResources] = useState<
    Record<string, boolean>
  >({});

  const { isPassingDeploymentVersionChannel } = useDeploymentVersionChannel(
    deployment.id,
    environment.id,
    deploymentVersion.tag,
  );

  const switchResourceExpandedState = (resourceId: string) =>
    setExpandedResources((prev) => {
      const newState = { ...prev };
      const currentResourceState = newState[resourceId] ?? false;
      newState[resourceId] = !currentResourceState;
      return newState;
    });

  return (
    <>
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
                {environment.statusCounts.map(({ status, count }) => (
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
              {/* {environmentApprovals.map((approval) => (
                <EnvironmentApprovalRow
                  key={approval.id}
                  approval={approval}
                  deploymentVersion={deploymentVersion}
                />
              ))} */}

              <EnvironmentRowDropdown
                jobIds={environment.releaseTargets.map((rt) => rt.jobs[0]!.id)}
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
          {environment.releaseTargets.map((rt) => {
            const latestJob = rt.jobs[0]!;
            const { resource } = rt;
            const linksMetadata = latestJob.metadata[ReservedMetadataKey.Links];

            const links =
              linksMetadata != null
                ? (JSON.parse(linksMetadata) as Record<string, string>)
                : null;

            return (
              <Collapsible key={resource.id} asChild>
                <>
                  <TableRow
                    className="cursor-pointer border-none"
                    onClick={() => setJobId(latestJob.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {rt.jobs.length > 1 && (
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

                      {rt.jobs.length === 1 && (
                        <div className="pl-[29px]">{resource.name}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <JobTableStatusIcon status={latestJob.status} />
                        {capitalCase(latestJob.status)}
                      </div>
                    </TableCell>
                    <TableCell>{latestJob.type}</TableCell>
                    <TableCell>
                      {latestJob.externalId != null ? (
                        <code className="font-mono text-xs">
                          {latestJob.externalId}
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
                        {latestJob.createdAt != null
                          ? formatDistanceToNowStrict(latestJob.createdAt, {
                              addSuffix: true,
                            })
                          : "not started"}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end">
                        <JobDropdownMenu
                          deploymentVersion={deploymentVersion}
                          deployment={deployment}
                          resource={resource}
                          environmentId={environment.id}
                          job={{
                            id: latestJob.id,
                            status: latestJob.status as JobStatus,
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
                      {rt.jobs.map((job, idx) => {
                        if (idx === 0) return null;
                        const linksMetadata =
                          job.metadata[ReservedMetadataKey.Links];

                        const links =
                          linksMetadata != null
                            ? (JSON.parse(linksMetadata) as Record<
                                string,
                                string
                              >)
                            : null;

                        return (
                          <TableRow
                            key={job.id}
                            className="cursor-pointer border-none"
                            onClick={() => setJobId(job.id)}
                          >
                            <TableCell className="p-0">
                              <div className="pl-5">
                                <div className="h-10 border-l border-neutral-700/50" />
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <JobTableStatusIcon status={job.status} />
                                {capitalCase(job.status)}
                              </div>
                            </TableCell>
                            <TableCell>{job.type}</TableCell>
                            <TableCell>
                              {job.externalId != null ? (
                                <code className="font-mono text-xs">
                                  {job.externalId}
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
                                {job.createdAt != null
                                  ? formatDistanceToNowStrict(job.createdAt, {
                                      addSuffix: true,
                                    })
                                  : "not started"}
                              </Badge>
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end">
                                <JobDropdownMenu
                                  deploymentVersion={deploymentVersion}
                                  deployment={deployment}
                                  resource={resource}
                                  environmentId={environment.id}
                                  job={{
                                    id: job.id,
                                    status: job.status as JobStatus,
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
    </>
  );
};
