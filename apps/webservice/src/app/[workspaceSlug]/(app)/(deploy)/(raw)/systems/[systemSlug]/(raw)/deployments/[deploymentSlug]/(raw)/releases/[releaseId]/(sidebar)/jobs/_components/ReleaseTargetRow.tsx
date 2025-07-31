"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  IconAlertTriangle,
  IconChevronRight,
  IconCopy,
  IconDots,
  IconExternalLink,
  IconReload,
  IconSwitch,
} from "@tabler/icons-react";
import { capitalCase } from "change-case";
import { formatDistanceToNowStrict } from "date-fns";
import { useCopyToClipboard } from "react-use";

import { cn } from "@ctrlplane/ui";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { TableCell, TableRow } from "@ctrlplane/ui/table";
import { toast } from "@ctrlplane/ui/toast";

import { JobTableStatusIcon } from "~/app/[workspaceSlug]/(app)/_components/job/JobTableStatusIcon";
import { OverrideJobStatusDialog } from "~/app/[workspaceSlug]/(app)/_components/job/OverrideJobStatusDialog";
import { ForceDeployVersionDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/ForceDeployVersion";
import { RedeployVersionDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/RedeployVersionDialog";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import { CollapsibleRow } from "./CollapsibleRow";
import { PolicyEvaluationsCell } from "./policy-evaluations/PolicyEvaluationsCell";

const ReleaseTargetActionsDropdownMenu: React.FC<{
  environment: { id: string; name: string };
  deployment: { id: string; name: string };
  resource: { id: string; name: string };
  job: { id: string; status: SCHEMA.Job["status"] } | null;
}> = ({ job, environment, deployment, resource }) => {
  const utils = api.useUtils();
  const [, copy] = useCopyToClipboard();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <IconDots className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {job != null && (
          <DropdownMenuItem
            onSelect={() => {
              copy(job.id);
              toast.success("Job ID copied to clipboard");
            }}
            className="flex items-center gap-2"
          >
            <IconCopy className="h-4 w-4" />
            Copy job ID
          </DropdownMenuItem>
        )}
        {job != null && (
          <OverrideJobStatusDialog
            jobs={[job]}
            enableStatusFilter={false}
            onClose={() => utils.deployment.version.job.list.invalidate()}
          >
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="flex items-center gap-2"
            >
              <IconSwitch className="h-4 w-4" />
              Override status
            </DropdownMenuItem>
          </OverrideJobStatusDialog>
        )}
        <RedeployVersionDialog
          environment={environment}
          deployment={deployment}
          resource={resource}
        >
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex items-center gap-2"
          >
            <IconReload className="h-4 w-4" />
            Redeploy
          </DropdownMenuItem>
        </RedeployVersionDialog>
        <ForceDeployVersionDialog
          environment={environment}
          deployment={deployment}
          resource={resource}
        >
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex items-center gap-2"
          >
            <IconAlertTriangle className="h-4 w-4" />
            Force deploy
          </DropdownMenuItem>
        </ForceDeployVersionDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const JobStatusCell: React.FC<{
  status: SCHEMA.JobStatus;
}> = ({ status }) => (
  <TableCell className="w-26">
    <div className="flex items-center gap-1">
      <JobTableStatusIcon status={status} />
      {capitalCase(status)}
    </div>
  </TableCell>
);

const ExternalIdCell: React.FC<{
  externalId: string | null;
}> = ({ externalId }) => (
  <TableCell>
    {externalId != null ? (
      <code className="font-mono text-xs">{externalId}</code>
    ) : (
      <span className="text-sm text-muted-foreground">No external ID</span>
    )}
  </TableCell>
);

const LinksCell: React.FC<{
  links: Record<string, string>;
}> = ({ links }) => (
  <TableCell onClick={(e) => e.stopPropagation()} className="py-0">
    <div className="flex items-center gap-1">
      {Object.entries(links).length === 0 && (
        <span className="text-sm text-muted-foreground">No links</span>
      )}
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
  </TableCell>
);

const CreatedAtCell: React.FC<{
  createdAt: Date;
}> = ({ createdAt }) => (
  <TableCell>
    {formatDistanceToNowStrict(createdAt, { addSuffix: true })}
  </TableCell>
);

const ResourceLink: React.FC<{
  resource: { id: string; name: string };
}> = ({ resource }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const url = urls.workspace(workspaceSlug).resource(resource.id).deployments();

  return (
    <Link
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {resource.name}
    </Link>
  );
};

export const ReleaseTargetRow: React.FC<{
  id: string;
  resource: { id: string; name: string };
  environment: { id: string; name: string };
  deployment: { id: string; name: string };
  version: { id: string; tag: string };
  jobs: Array<{
    id: string;
    status: SCHEMA.JobStatus;
    externalId: string | null;
    links: Record<string, string>;
    createdAt: Date;
  }>;
}> = ({ id, resource, environment, deployment, jobs, version }) => {
  const latestJob = jobs.at(0);

  return (
    <CollapsibleRow
      key={id}
      Heading={({ isExpanded }) => (
        <>
          <TableCell className={cn("h-10", jobs.length === 0 && "w-[360px]")}>
            {jobs.length > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <IconChevronRight
                    className={cn(
                      "h-3 w-3 text-muted-foreground transition-all",
                      isExpanded && "rotate-90",
                    )}
                  />
                </Button>
                <ResourceLink resource={resource} />
              </div>
            )}

            {jobs.length <= 1 && (
              <div className="pl-[29px]">
                <ResourceLink resource={resource} />
              </div>
            )}
          </TableCell>
          {latestJob != null && (
            <>
              <JobStatusCell status={latestJob.status} />
              <ExternalIdCell externalId={latestJob.externalId} />
              <LinksCell links={latestJob.links} />
              <CreatedAtCell createdAt={latestJob.createdAt} />
            </>
          )}

          {latestJob == null && (
            <>
              <TableCell className="p-0">
                <PolicyEvaluationsCell
                  releaseTargetId={id}
                  version={version}
                  resource={resource}
                />
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell />
            </>
          )}
        </>
      )}
      DropdownMenu={
        <TableCell className="flex justify-end">
          <ReleaseTargetActionsDropdownMenu
            job={latestJob ?? null}
            environment={environment}
            deployment={deployment}
            resource={resource}
          />
        </TableCell>
      }
    >
      {jobs.map((job, idx) => {
        if (idx === 0) return null;
        return (
          <TableRow key={job.id}>
            <TableCell className="p-0">
              <div className="pl-5">
                <div className="h-10 border-l border-neutral-700/50" />
              </div>
            </TableCell>
            <JobStatusCell status={job.status} />
            <ExternalIdCell externalId={job.externalId} />
            <LinksCell links={job.links} />
            <CreatedAtCell createdAt={job.createdAt} />
            <TableCell></TableCell>
          </TableRow>
        );
      })}
    </CollapsibleRow>
  );
};
