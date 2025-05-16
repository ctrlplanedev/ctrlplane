"use client";

import type * as schema from "@ctrlplane/db/schema";
import React, { useState } from "react";
import Link from "next/link";
import { IconExternalLink } from "@tabler/icons-react";

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
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { api } from "~/trpc/react";

type ReleaseHistoryTableProps = {
  releaseTargets: (schema.ReleaseTarget & {
    deployment: schema.Deployment;
  })[];
};

type VariablesCellProps = {
  variables: Record<string, any>;
};

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

type JobCellProps = {
  job: { metadata: Record<string, string> };
};

const JobCell: React.FC<JobCellProps> = ({ job }) => {
  const linksMetadata = job.metadata[ReservedMetadataKey.Links];
  const links =
    linksMetadata != null
      ? (JSON.parse(linksMetadata) as Record<string, string>)
      : null;

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

export const ReleaseHistoryTable: React.FC<ReleaseHistoryTableProps> = ({
  releaseTargets,
}) => {
  const [selectedReleaseTarget, setSelectedReleaseTarget] =
    useState<schema.ReleaseTarget | null>(releaseTargets.at(0) ?? null);

  const { data, isLoading } = api.releaseTarget.releaseHistory.useQuery(
    selectedReleaseTarget?.id ?? "",
  );

  const history = data ?? [];

  return (
    <div>
      <div className="p-2">
        <Select
          value={selectedReleaseTarget?.id}
          onValueChange={(value) => {
            const releaseTarget = releaseTargets.find((rt) => rt.id === value);
            setSelectedReleaseTarget(releaseTarget ?? null);
          }}
        >
          <SelectTrigger className="w-60">
            <SelectValue placeholder="Select a deployment" />
          </SelectTrigger>
          <SelectContent>
            {releaseTargets.map((rt) => (
              <SelectItem key={rt.id} value={rt.id}>
                {rt.deployment.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isLoading && (
        <div className="space-y-2 p-4">
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
              <TableHead>Version</TableHead>
              <TableHead>Variables</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Released</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {history.map((h) => (
              <TableRow key={h.job.id}>
                <TableCell>{h.version.tag}</TableCell>
                <TableCell>
                  <VariablesCell variables={h.variables} />
                </TableCell>
                <JobCell job={h.job} />
                <TableCell>{h.job.createdAt.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
