"use client";

import type * as schema from "@ctrlplane/db/schema";
import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { capitalCase } from "change-case";
import { formatDistanceToNow } from "date-fns";

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
import { JobStatus } from "@ctrlplane/validators/jobs";

import { JobTableStatusIcon } from "~/app/[workspaceSlug]/(app)/_components/job/JobTableStatusIcon";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import { CondensedJobLinksCell, JobLinksCell } from "./JobLinksCell";
import { JobRowDropdown } from "./JobRowDropdown";
import { VariablesCell } from "./VariablesCell";
import { VersionTagCell } from "./VersionTagCell";

type ReleaseHistoryTableProps = {
  resource: schema.Resource;
  deployments: { id: string; name: string }[];
  condensed?: boolean;
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
  resource,
  deployments,
  condensed = false,
}) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [selectedDeploymentId, setSelectedDeploymentId] =
    useState<string>("all");

  const [selectedJobStatus, setSelectedJobStatus] = useState<JobStatus | "all">(
    "all",
  );

  const resourceId = resource.id;
  const deploymentId =
    selectedDeploymentId === "all" ? undefined : selectedDeploymentId;
  const jobStatus = selectedJobStatus === "all" ? undefined : selectedJobStatus;

  const { data, isLoading } = api.resource.releaseHistory.useQuery(
    { resourceId, deploymentId, jobStatus },
    { refetchInterval: 5_000 },
  );
  const history = data ?? [];

  return (
    <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 w-full overflow-auto">
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
              <TableHead />
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

                <TableCell>
                  <div className="flex items-center justify-end">
                    <JobRowDropdown
                      job={h.job}
                      releaseTarget={{
                        deployment: h.deployment,
                        environment: h.environment,
                        resource,
                      }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
