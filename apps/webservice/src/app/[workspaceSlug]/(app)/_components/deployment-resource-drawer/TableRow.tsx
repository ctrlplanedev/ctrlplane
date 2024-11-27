import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";
import type { JobStatus } from "@ctrlplane/validators/jobs";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  IconChevronRight,
  IconDots,
  IconExternalLink,
  IconLoader2,
} from "@tabler/icons-react";
import { formatDistanceToNowStrict } from "date-fns";

import { cn } from "@ctrlplane/ui";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@ctrlplane/ui/collapsible";
import { TableCell, TableRow } from "@ctrlplane/ui/table";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { JobStatusReadable } from "@ctrlplane/validators/jobs";

import { api } from "~/trpc/react";
import { JobDropdownMenu } from "../../systems/[systemSlug]/deployments/[deploymentSlug]/releases/[versionId]/JobDropdownMenu";
import { DeployButton } from "../../systems/[systemSlug]/deployments/DeployButton";
import { JobTableStatusIcon } from "../JobTableStatusIcon";

type ReleaseJobTrigger = SCHEMA.ReleaseJobTrigger & {
  job: SCHEMA.Job;
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

type LinksCellProps = {
  releaseJobTrigger?: ReleaseJobTrigger;
};

const LinksCell: React.FC<LinksCellProps> = ({ releaseJobTrigger }) => {
  const jobQ = api.job.config.byId.useQuery(releaseJobTrigger?.job.id ?? "", {
    enabled: releaseJobTrigger != null,
    refetchInterval: 5_000,
  });
  const job = jobQ.data;
  const linksMetadata = job?.job.metadata.find(
    (m) => m.key === String(ReservedMetadataKey.Links),
  );
  const links =
    linksMetadata != null
      ? (JSON.parse(linksMetadata.value) as Record<string, string>)
      : null;

  if (jobQ.isLoading)
    return (
      <TableCell>
        <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </TableCell>
    );

  if (links == null) return <TableCell />;

  const numLinks = Object.keys(links).length;
  if (numLinks <= 3)
    return (
      <TableCell className="py-0">
        <div
          className="flex flex-wrap gap-2"
          onClick={(e) => e.stopPropagation()}
        >
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
                "h-6 max-w-20 gap-1 truncate px-2 py-0",
              )}
            >
              <IconExternalLink className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>
      </TableCell>
    );

  return <TableCell />;
};

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
          target={resource}
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
        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {isExpandable && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5">
                <IconChevronRight
                  className={cn(
                    "h-3 w-3 text-muted-foreground transition-all",
                    isExpanded && "rotate-90",
                  )}
                />
              </Button>
            </CollapsibleTrigger>
          )}

          <span className={cn("truncate", !isExpandable && "pl-7")}>
            {release.name}
          </span>
        </div>
      </TableCell>
      <StatusCell
        releaseJobTrigger={releaseJobTrigger}
        releaseId={release.id}
        environmentId={environment.id}
      />
      <CreatedCell releaseJobTrigger={releaseJobTrigger} />
      <LinksCell releaseJobTrigger={releaseJobTrigger} />
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
      <LinksCell releaseJobTrigger={releaseJobTrigger} />
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

type Release =
  RouterOutputs["job"]["config"]["byDeploymentEnvAndResource"][number];

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
