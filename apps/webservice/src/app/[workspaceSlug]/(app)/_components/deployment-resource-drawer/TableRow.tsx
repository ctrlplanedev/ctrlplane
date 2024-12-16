import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";
import type { JobStatus } from "@ctrlplane/validators/jobs";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { IconChevronRight, IconDots } from "@tabler/icons-react";
import { formatDistanceToNowStrict } from "date-fns";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@ctrlplane/ui/collapsible";
import { TableCell, TableRow } from "@ctrlplane/ui/table";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { JobStatusReadable } from "@ctrlplane/validators/jobs";

import { JobDropdownMenu } from "../../systems/[systemSlug]/deployments/[deploymentSlug]/releases/[versionId]/JobDropdownMenu";
import { DeployButton } from "../../systems/[systemSlug]/deployments/DeployButton";
import { JobLinksCell } from "../job-table/JobLinksCell";
import { JobTableStatusIcon } from "../JobTableStatusIcon";

type ReleaseJobTrigger = SCHEMA.ReleaseJobTrigger & {
  job: SCHEMA.Job & { metadata: SCHEMA.JobMetadata[] };
};

type StatusCellProps = {
  releaseJobTrigger?: ReleaseJobTrigger;
  releaseId: string;
  environmentId: string;
};

const StatusCell: React.FC<StatusCellProps> = ({
  releaseJobTrigger,
  releaseId,
  environmentId,
}) => (
  <TableCell className="py-0">
    {releaseJobTrigger != null && (
      <div className="flex items-center gap-2">
        <JobTableStatusIcon status={releaseJobTrigger.job.status} />
        <span className="text-xs">
          {JobStatusReadable[releaseJobTrigger.job.status]}
        </span>
      </div>
    )}
    {releaseJobTrigger == null && (
      <div onClick={(e) => e.stopPropagation()}>
        <DeployButton
          releaseId={releaseId}
          environmentId={environmentId}
          className="h-6 w-20"
        />
      </div>
    )}
  </TableCell>
);

type CreatedCellProps = {
  releaseJobTrigger?: ReleaseJobTrigger;
};

const CreatedCell: React.FC<CreatedCellProps> = ({ releaseJobTrigger }) => (
  <TableCell>
    {releaseJobTrigger != null && (
      <span className="text-xs">
        {formatDistanceToNowStrict(releaseJobTrigger.createdAt, {
          addSuffix: true,
        })}
      </span>
    )}
    {releaseJobTrigger == null && (
      <span className="text-xs text-muted-foreground">Not deployed</span>
    )}
  </TableCell>
);

type DropdownCellProps = {
  releaseJobTrigger?: ReleaseJobTrigger;
  release: SCHEMA.Release;
  environmentId: string;
  resource: SCHEMA.Resource;
  deployment: SCHEMA.Deployment;
};

const DropdownCell: React.FC<DropdownCellProps> = ({
  releaseJobTrigger,
  release,
  environmentId,
  resource,
  deployment,
}) => (
  <TableCell>
    <div className="flex justify-end">
      {releaseJobTrigger != null && (
        <JobDropdownMenu
          release={release}
          environmentId={environmentId}
          resource={resource}
          deployment={deployment}
          job={{
            id: releaseJobTrigger.job.id,
            status: releaseJobTrigger.job.status as JobStatus,
          }}
          isPassingReleaseChannel
        >
          <Button variant="ghost" size="icon" className="h-5 w-5">
            <IconDots className="h-4 w-4" />
          </Button>
        </JobDropdownMenu>
      )}
    </div>
  </TableCell>
);

type ReleaseJobTriggerRowProps = {
  releaseJobTrigger?: ReleaseJobTrigger;
  release: SCHEMA.Release;
  environment: SCHEMA.Environment & { system: SCHEMA.System };
  deployment: SCHEMA.Deployment;
  resource: SCHEMA.Resource;
};

type ReleaseJobTriggerParentRowProps = ReleaseJobTriggerRowProps & {
  isExpandable: boolean;
  isExpanded: boolean;
};

const ReleaseJobTriggerParentRow: React.FC<ReleaseJobTriggerParentRowProps> = ({
  releaseJobTrigger,
  release,
  environment,
  deployment,
  resource,
  isExpandable,
  isExpanded,
}) => {
  const router = useRouter();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  return (
    <TableRow
      key={releaseJobTrigger?.id ?? release.id}
      onClick={() =>
        router.push(
          `/${workspaceSlug}/systems/${environment.system.slug}/deployments/${deployment.slug}/releases/${release.id}`,
        )
      }
      className="cursor-pointer"
    >
      <TableCell>
        {isExpandable && (
          <div onClick={(e) => e.stopPropagation()}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 flex-shrink-0"
                >
                  <IconChevronRight
                    className={cn(
                      "h-3 w-3 text-muted-foreground transition-all",
                      isExpanded && "rotate-90",
                    )}
                  />
                </Button>
                <span className="truncate">{release.name}</span>
              </div>
            </CollapsibleTrigger>
          </div>
        )}
        {!isExpandable && (
          <div className="flex">
            <span className="truncate pl-7">{release.name}</span>
          </div>
        )}
      </TableCell>
      <StatusCell
        releaseJobTrigger={releaseJobTrigger}
        releaseId={release.id}
        environmentId={environment.id}
      />
      <CreatedCell releaseJobTrigger={releaseJobTrigger} />
      <JobLinksCell
        linksMetadata={releaseJobTrigger?.job.metadata.find(
          (m) => m.key === String(ReservedMetadataKey.Links),
        )}
      />
      <DropdownCell
        releaseJobTrigger={releaseJobTrigger}
        release={release}
        environmentId={environment.id}
        deployment={deployment}
        resource={resource}
      />
    </TableRow>
  );
};

const ReleaseJobTriggerChildRow: React.FC<ReleaseJobTriggerRowProps> = ({
  releaseJobTrigger,
  release,
  environment,
  deployment,
  resource,
}) => {
  const router = useRouter();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  return (
    <TableRow
      key={releaseJobTrigger?.id ?? release.id}
      onClick={() =>
        router.push(
          `/${workspaceSlug}/systems/${environment.system.slug}/deployments/${deployment.slug}/releases/${release.id}`,
        )
      }
      className="cursor-pointer"
    >
      <TableCell />
      <StatusCell
        releaseJobTrigger={releaseJobTrigger}
        releaseId={release.id}
        environmentId={environment.id}
      />
      <CreatedCell releaseJobTrigger={releaseJobTrigger} />
      <JobLinksCell
        linksMetadata={releaseJobTrigger?.job.metadata.find(
          (m) => m.key === String(ReservedMetadataKey.Links),
        )}
      />
      <DropdownCell
        releaseJobTrigger={releaseJobTrigger}
        release={release}
        environmentId={environment.id}
        deployment={deployment}
        resource={resource}
      />
    </TableRow>
  );
};

type Release = RouterOutputs["release"]["list"]["items"][number];

type ReleaseRowsProps = {
  release: Release;
  environment: SCHEMA.Environment & { system: SCHEMA.System };
  deployment: SCHEMA.Deployment;
  resource: SCHEMA.Resource;
};

export const ReleaseRows: React.FC<ReleaseRowsProps> = ({
  release,
  environment,
  deployment,
  resource,
}) => {
  const [open, setOpen] = useState(false);
  const { releaseJobTriggers } = release;
  const hasOtherReleaseJobTriggers = releaseJobTriggers.length > 1;

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <>
        <ReleaseJobTriggerParentRow
          release={release}
          environment={environment}
          deployment={deployment}
          resource={resource}
          releaseJobTrigger={releaseJobTriggers[0]}
          isExpandable={hasOtherReleaseJobTriggers}
          isExpanded={open}
          key={releaseJobTriggers[0]?.id ?? `${release.id}-parent`}
        />
        <CollapsibleContent asChild>
          <>
            {releaseJobTriggers.map((trigger, idx) => {
              if (idx === 0) return null;
              return (
                <ReleaseJobTriggerChildRow
                  release={release}
                  releaseJobTrigger={trigger}
                  environment={environment}
                  deployment={deployment}
                  resource={resource}
                  key={trigger.id}
                />
              );
            })}
          </>
        </CollapsibleContent>
      </>
    </Collapsible>
  );
};
