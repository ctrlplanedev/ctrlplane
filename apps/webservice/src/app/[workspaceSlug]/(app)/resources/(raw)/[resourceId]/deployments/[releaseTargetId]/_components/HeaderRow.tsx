import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import { IconChevronRight, IconPinFilled } from "@tabler/icons-react";
import { formatDistanceToNowStrict } from "date-fns";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import { TableCell } from "@ctrlplane/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import type { JobWithLinks, ReleaseTarget } from "../types";
import { JobLinks } from "~/app/[workspaceSlug]/(app)/_components/job/JobLinks";
import { JobStatusCell } from "./JobStatusCell";

const TruncatedTextTooltip: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="truncate">{children}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="border bg-neutral-950 p-2">
        <span>{children}</span>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const TagCell: React.FC<{
  isExpanded: boolean;
  isPinned: boolean;
  tag: string;
}> = ({ isExpanded, isPinned, tag }) => (
  <TableCell className="max-w-[200px]">
    <div className="flex items-center gap-1 truncate">
      <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
        <IconChevronRight
          className={cn(
            "h-3 w-3 text-muted-foreground transition-all",
            isExpanded && "rotate-90",
          )}
        />
      </Button>
      <TruncatedTextTooltip>
        <div className="flex items-center gap-1">
          {isPinned && (
            <IconPinFilled className="h-4 w-4 flex-shrink-0 text-orange-500" />
          )}
          {tag}
        </div>
      </TruncatedTextTooltip>
    </div>
  </TableCell>
);

const JobDateCell: React.FC<{
  job?: schema.Job;
}> = ({ job }) => (
  <TableCell>
    {job?.createdAt != null
      ? formatDistanceToNowStrict(job.createdAt, {
          addSuffix: true,
        })
      : ""}
  </TableCell>
);

export const HeaderRow: React.FC<{
  isExpanded: boolean;
  releaseTarget: ReleaseTarget;
  deploymentVersion: schema.DeploymentVersion;
  job?: JobWithLinks;
}> = ({ isExpanded, releaseTarget, deploymentVersion, job }) => (
  <>
    <TagCell
      isExpanded={isExpanded}
      isPinned={releaseTarget.desiredVersionId === deploymentVersion.id}
      tag={deploymentVersion.tag}
    />
    <TableCell className="max-w-[300px]">
      <div className="flex items-center gap-1 truncate">
        <TruncatedTextTooltip>{deploymentVersion.name}</TruncatedTextTooltip>
      </div>
    </TableCell>
    {job != null && (
      <JobStatusCell
        releaseTargetId={releaseTarget.id}
        versionId={deploymentVersion.id}
        status={job.status}
      />
    )}
    {job == null && <TableCell>No jobs</TableCell>}
    <JobDateCell job={job} />
    <TableCell>
      <JobLinks links={job?.links ?? {}} />
    </TableCell>
  </>
);
