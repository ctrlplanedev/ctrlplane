/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { useState } from "react";
import { Fragment } from "react/jsx-runtime";
import { ChevronRight, ExternalLink } from "lucide-react";

import type { JobStatusDisplayName } from "../../../_components/JobStatusBadge";
import { Button, buttonVariants } from "~/components/ui/button";
import { ResourceIcon } from "~/components/ui/resource-icon";
import { TableCell, TableRow } from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { JobStatusBadge } from "../../../_components/JobStatusBadge";
import { RedeployDialog } from "../RedeployDialog";
import { RedeployAllDialog } from "./RedeployAllDialog";
import { VerificationStatusBadge, verificationSummary } from "./Verifications";

type ReleaseTargetSummary = WorkspaceEngine["schemas"]["ReleaseTargetSummary"];

type EnvironmentReleaseTargetsGroupProps = {
  releaseTargets: ReleaseTargetSummary[];
  environment: { id: string; name: string };
};

type ReleaseTargetRowProps = {
  rt: ReleaseTargetSummary;
};

function JobLinks({ links }: { links?: Record<string, string> }) {
  const entries = Object.entries(links ?? {});

  return (
    <TableCell>
      <div className="flex gap-1">
        {entries.map(([label, url]) => (
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

function ReleaseTargetRow({ rt }: ReleaseTargetRowProps) {
  const verifications = rt.latestJob?.verifications ?? [];
  const summaries = verifications.map(verificationSummary).flat();

  const currentVersionTag =
    rt.currentVersion?.name || rt.currentVersion?.tag || "Not yet deployed";
  const desiredVersionTag =
    rt.desiredVersion?.name || rt.desiredVersion?.tag || "unknown";
  const isInSync =
    currentVersionTag === desiredVersionTag || rt.desiredVersion == null;

  const jobStatus = rt.latestJob?.status;
  const isProgressing = jobStatus === "inProgress" || jobStatus === "pending";
  const isUnhealthy =
    jobStatus === "failure" ||
    jobStatus === "invalidJobAgent" ||
    jobStatus === "invalidIntegration" ||
    jobStatus === "externalRunNotFound";

  const tag = isInSync
    ? currentVersionTag
    : `${currentVersionTag} → ${desiredVersionTag}`;

  return (
    <TableRow key={rt.releaseTarget.resourceId}>
      <TableCell>
        <div className="flex items-center gap-2">
          <ResourceIcon kind={rt.resource.kind} version={rt.resource.version} />
          {rt.resource.name}
        </div>
      </TableCell>
      <TableCell>
        {rt.latestJob != null && (
          <div className="flex items-center gap-2">
            {<JobStatusBadge {...rt.latestJob} />}
            <VerificationStatusBadge
              summaries={summaries}
              verifications={verifications}
            />
          </div>
        )}
      </TableCell>
      <JobLinks links={rt.latestJob?.links} />
      <TableCell
        className={cn(
          "font-mono text-sm",
          isInSync
            ? "text-green-500"
            : isProgressing
              ? "text-blue-500"
              : isUnhealthy
                ? "text-red-500"
                : "text-neutral-500",
        )}
      >
        {tag}
      </TableCell>
      <TableCell className="text-right">
        <RedeployDialog
          releaseTarget={rt.releaseTarget}
          resourceIdentifier={rt.resource.identifier}
        />
      </TableCell>
    </TableRow>
  );
}

export function EnvironmentReleaseTargetsGroup(
  props: EnvironmentReleaseTargetsGroupProps,
) {
  const { releaseTargets, environment } = props;
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
      {rts.map((rt) => (
        <ReleaseTargetRow key={rt.releaseTarget.resourceId} rt={rt} />
      ))}
    </Fragment>
  );
}
