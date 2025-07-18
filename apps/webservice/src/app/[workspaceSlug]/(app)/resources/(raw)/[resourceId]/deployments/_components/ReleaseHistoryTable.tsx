"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconExternalLink } from "@tabler/icons-react";
import { capitalCase } from "change-case";
import { formatDistanceToNow } from "date-fns";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrlplane/ui/hover-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { JobTableStatusIcon } from "~/app/[workspaceSlug]/(app)/_components/job/JobTableStatusIcon";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

type ReleaseHistoryTableProps = {
  resourceId: string;
  deployments: { id: string; name: string }[];
  condensed?: boolean;
};

type VariablesCellProps = {
  variables: Record<string, any>;
};

const VersionTagCell: React.FC<{
  version: { id: string; tag: string };
  urlParams: {
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  };
}> = ({ version, urlParams }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          target="_blank"
          rel="noopener noreferrer"
          href={urls
            .workspace(urlParams.workspaceSlug)
            .system(urlParams.systemSlug)
            .deployment(urlParams.deploymentSlug)
            .release(version.id)
            .jobs()}
        >
          <div className="cursor-pointer truncate underline-offset-2 hover:underline">
            {version.tag}
          </div>
        </Link>
      </TooltipTrigger>
      <TooltipContent className="p-2" align="start">
        <pre>{version.tag}</pre>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const VariablesCell: React.FC<VariablesCellProps> = ({ variables }) => (
  <HoverCard>
    <HoverCardTrigger asChild>
      <Badge variant="secondary" className="cursor-pointer">
        {Object.keys(variables).length} variables
      </Badge>
    </HoverCardTrigger>
    <HoverCardContent>
      <div className="flex gap-2">
        <div className="flex-grow space-y-2">
          {Object.keys(variables).map((key) => (
            <div key={key} className="min-w-0 truncate">
              <span className="font-medium">{key}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {Object.entries(variables).map(([key, value]) => (
            <div key={key}>
              <pre>{JSON.stringify(value, null, 2)}</pre>
            </div>
          ))}
        </div>
      </div>
    </HoverCardContent>
  </HoverCard>
);

type JobLinksCellProps = {
  job: { links: Record<string, string> | null };
};

const JobLinksCell: React.FC<JobLinksCellProps> = ({ job }) => {
  const { links } = job;
  if (links == null) return <TableCell />;

  const numLinks = Object.keys(links).length;
  if (numLinks <= 3)
    return (
      <TableCell className="py-0">
        <div className="flex flex-wrap gap-2">
          {Object.entries(links).map(([label, url]) => (
            <Link
              key={label}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({
                  variant: "secondary",
                  size: "sm",
                }),
                "h-6 max-w-24 gap-1 truncate px-2 py-0",
              )}
            >
              <IconExternalLink className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </div>
      </TableCell>
    );

  const firstThreeLinks = Object.entries(links).slice(0, 3);
  const remainingLinks = Object.entries(links).slice(3);

  return (
    <TableCell className="py-0">
      <div className="flex flex-wrap gap-2">
        {firstThreeLinks.map(([label, url]) => (
          <Link
            key={label}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({
                variant: "secondary",
                size: "sm",
              }),
              "h-6 max-w-24 gap-1 truncate px-2 py-0",
            )}
          >
            <IconExternalLink className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        ))}
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button variant="secondary" size="sm" className="h-6">
              +{remainingLinks.length} more
            </Button>
          </HoverCardTrigger>
          <HoverCardContent
            className="flex max-w-40 flex-col gap-1 p-2"
            align="start"
          >
            {remainingLinks.map(([label, url]) => (
              <Link
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm underline-offset-1 hover:underline"
              >
                {label}
              </Link>
            ))}
          </HoverCardContent>
        </HoverCard>
      </div>
    </TableCell>
  );
};

const CondensedJobLinksCell: React.FC<JobLinksCellProps> = ({ job }) => {
  const { links } = job;
  if (links == null) return null;

  const numLinks = Object.keys(links).length;

  return (
    <TableCell className="py-0">
      <div className="flex flex-wrap gap-2">
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button variant="secondary" size="sm" className="h-6">
              {numLinks} links
            </Button>
          </HoverCardTrigger>
          <HoverCardContent
            className="flex max-w-40 flex-col gap-1 p-2"
            align="start"
          >
            {Object.entries(links).map(([label, url]) => (
              <Link
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm underline-offset-1 hover:underline"
              >
                {label}
              </Link>
            ))}
          </HoverCardContent>
        </HoverCard>
      </div>
    </TableCell>
  );
};

const DeploymentSelect: React.FC<{
  deployments: { id: string; name: string }[];
  selectedDeploymentId: string;
  onDeploymentIdChange: (deploymentId: string) => void;
}> = ({ deployments, selectedDeploymentId, onDeploymentIdChange }) => (
  <Select
    value={selectedDeploymentId}
    onValueChange={(value) => onDeploymentIdChange(value)}
  >
    <SelectTrigger className="w-60">
      <SelectValue placeholder="All deployments" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All deployments</SelectItem>
      {deployments.map((deployment) => (
        <SelectItem key={deployment.id} value={deployment.id}>
          {deployment.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const JobStatusSelect: React.FC<{
  selectedJobStatus: JobStatus | "all";
  onJobStatusChange: (jobStatus: JobStatus | "all") => void;
}> = ({ selectedJobStatus, onJobStatusChange }) => (
  <Select
    value={selectedJobStatus}
    onValueChange={(value) => onJobStatusChange(value as JobStatus | "all")}
  >
    <SelectTrigger className="w-60">
      <SelectValue placeholder="All job statuses" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All job statuses</SelectItem>
      {Object.values(JobStatus).map((status) => (
        <SelectItem key={status} value={status}>
          {capitalCase(status)}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export const ReleaseHistoryTable: React.FC<ReleaseHistoryTableProps> = ({
  resourceId,
  deployments,
  condensed = false,
}) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [selectedDeploymentId, setSelectedDeploymentId] =
    useState<string>("all");

  const [selectedJobStatus, setSelectedJobStatus] = useState<JobStatus | "all">(
    "all",
  );

  const { data, isLoading } = api.resource.releaseHistory.useQuery({
    resourceId,
    deploymentId:
      selectedDeploymentId === "all" ? undefined : selectedDeploymentId,
    jobStatus: selectedJobStatus === "all" ? undefined : selectedJobStatus,
  });
  const history = data ?? [];

  return (
    <div className="w-full">
      <div className="flex w-full items-center justify-end gap-2 p-2">
        <DeploymentSelect
          deployments={deployments}
          selectedDeploymentId={selectedDeploymentId}
          onDeploymentIdChange={setSelectedDeploymentId}
        />

        <JobStatusSelect
          selectedJobStatus={selectedJobStatus}
          onJobStatusChange={setSelectedJobStatus}
        />
      </div>
      {isLoading && (
        <div className="w-full space-y-2 p-4">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-9 w-full"
              style={{ opacity: 1 * (1 - index / 10) }}
            />
          ))}
        </div>
      )}
      {!isLoading && (
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>Deployment</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Variables</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Links</TableHead>
              <TableHead>Released</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {history.map((h) => (
              <TableRow key={h.job.id}>
                <TableCell>
                  <Link
                    target="_blank"
                    rel="noopener noreferrer"
                    href={urls
                      .workspace(workspaceSlug)
                      .system(h.system.slug)
                      .deployment(h.deployment.slug)
                      .baseUrl()}
                  >
                    <div className="cursor-pointer truncate underline-offset-2 hover:underline">
                      {h.deployment.name}
                    </div>
                  </Link>
                </TableCell>
                <TableCell>
                  <VersionTagCell
                    version={h.version}
                    urlParams={{
                      workspaceSlug,
                      systemSlug: h.system.slug,
                      deploymentSlug: h.deployment.slug,
                    }}
                  />
                </TableCell>
                <TableCell>
                  <VariablesCell variables={h.variables} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <JobTableStatusIcon status={h.job.status} />
                    {capitalCase(h.job.status)}
                  </div>
                </TableCell>
                {condensed ? (
                  <CondensedJobLinksCell job={h.job} />
                ) : (
                  <JobLinksCell job={h.job} />
                )}
                <TableCell>
                  {condensed
                    ? formatDistanceToNow(h.job.createdAt, { addSuffix: true })
                    : h.job.createdAt.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
