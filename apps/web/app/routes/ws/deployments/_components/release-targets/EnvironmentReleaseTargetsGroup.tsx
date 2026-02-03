import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { useState } from "react";
import { Fragment } from "react/jsx-runtime";
import { ChevronRight, ExternalLink } from "lucide-react";

import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import type { JobStatusDisplayName } from "../../../_components/JobStatusBadge";
import { Button, buttonVariants } from "~/components/ui/button";
import { ResourceIcon } from "~/components/ui/resource-icon";
import { TableCell, TableRow } from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { JobStatusBadge } from "../../../_components/JobStatusBadge";
import { RedeployDialog } from "../RedeployDialog";
import { RedeployAllDialog } from "./RedeployAllDialog";
import { VerificationStatusBadge, verificationSummary } from "./Verifications";
import { VersionDisplay } from "./VersionDisplay";

type ReleaseTarget = WorkspaceEngine["schemas"]["ReleaseTargetWithState"];
type ReleaseTargetState = WorkspaceEngine["schemas"]["ReleaseTargetState"];
type Resource = WorkspaceEngine["schemas"]["Resource"];
type Job = WorkspaceEngine["schemas"]["Job"];

type Environment = WorkspaceEngine["schemas"]["Environment"];
type EnvironmentReleaseTargetsGroupProps = {
  releaseTargets: ReleaseTarget[];
  environment: Environment;
};

type ReleaseTargetRowProps = {
  releaseTarget: {
    deploymentId: string;
    environmentId: string;
    resourceId: string;
  };
  state: ReleaseTargetState;
  resource: Resource;
};

function JobLinks({ job }: { job?: Job }) {
  const { metadata } = job ?? {};
  const links: Record<string, string> =
    metadata?.[ReservedMetadataKey.Links] != null
      ? JSON.parse(metadata[ReservedMetadataKey.Links])
      : {};

  return (
    <TableCell>
      <div className="flex gap-1">
        {Object.entries(links).map(([label, url]) => (
          <a
            key={label}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "max-w-30 flex h-6 items-center gap-1.5 rounded-sm border border-neutral-200 px-2 py-0 text-xs dark:border-neutral-700",
            )}
          >
            <span className="truncate">{label}</span>
            <ExternalLink className="size-3 shrink-0" />
          </a>
        ))}
      </div>
    </TableCell>
  );
}

function ReleaseTargetRow({
  releaseTarget,
  state,
  resource,
}: ReleaseTargetRowProps) {
  const verifications = state.latestJob?.verifications ?? [];
  const summaries = verifications.map(verificationSummary).flat();

  return (
    <TableRow key={releaseTarget.resourceId}>
      <TableCell>
        <div className="flex items-center gap-2">
          <ResourceIcon kind={resource.kind} version={resource.version} />
          {resource.name}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <JobStatusBadge
            message={state.latestJob?.job.message}
            status={
              (state.latestJob?.job.status ??
                "unknown") as keyof typeof JobStatusDisplayName
            }
          />
          <VerificationStatusBadge
            summaries={summaries}
            verifications={verifications}
          />
        </div>
      </TableCell>
      <JobLinks job={state.latestJob?.job} />
      <VersionDisplay {...state} />
      <TableCell className="text-right">
        <RedeployDialog
          releaseTarget={releaseTarget}
          resourceIdentifier={resource.identifier}
        />
      </TableCell>
    </TableRow>
  );
}

export function EnvironmentReleaseTargetsGroup({
  releaseTargets,
  environment,
}: EnvironmentReleaseTargetsGroupProps) {
  const [open, setOpen] = useState(true);
  const rts = open ? releaseTargets : [];

  return (
    <Fragment key={environment.id}>
      <TableRow key={environment.id}>
        <TableCell colSpan={5} className="bg-muted/50">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setOpen(!open)}
              className="size-5 shrink-0"
            >
              <ChevronRight
                className={cn("s-4 transition-transform", open && "rotate-90")}
              />
            </Button>
            <div className="grow">{environment.name} </div>
            <RedeployAllDialog releaseTargets={rts} />
          </div>
        </TableCell>
      </TableRow>
      {rts.map(({ releaseTarget, state, resource }) => (
        <ReleaseTargetRow
          key={releaseTarget.resourceId}
          releaseTarget={releaseTarget}
          state={state}
          resource={resource}
        />
      ))}
    </Fragment>
  );
}
