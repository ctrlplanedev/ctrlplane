import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";
import type { JobCondition } from "@ctrlplane/validators/jobs";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { IconChevronRight } from "@tabler/icons-react";
import { formatDistanceToNowStrict } from "date-fns";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@ctrlplane/ui/collapsible";
import { TableCell, TableRow } from "@ctrlplane/ui/table";
import {
  ColumnOperator,
  ComparisonOperator,
  ConditionType,
  ReservedMetadataKey,
} from "@ctrlplane/validators/conditions";
import {
  JobConditionType,
  JobStatusReadable,
} from "@ctrlplane/validators/jobs";

import { api } from "~/trpc/react";
import { urls } from "../../../../../urls";
import { JobTableStatusIcon } from "../../job/JobTableStatusIcon";
import { JobLinksCell } from "./JobLinksCell";

type ReleaseJobTrigger = SCHEMA.ReleaseJobTrigger & {
  job: SCHEMA.Job & { metadata: SCHEMA.JobMetadata[] };
};

type StatusCellProps = {
  releaseJobTrigger?: ReleaseJobTrigger;
  versionId: string;
  environmentId: string;
};

const StatusCell: React.FC<StatusCellProps> = ({ releaseJobTrigger }) => (
  <TableCell className="py-0">
    {releaseJobTrigger != null && (
      <div className="flex items-center gap-2">
        <JobTableStatusIcon status={releaseJobTrigger.job.status} />
        <span className="text-xs">
          {JobStatusReadable[releaseJobTrigger.job.status]}
        </span>
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
  version: SCHEMA.DeploymentVersion;
  environmentId: string;
  resource: SCHEMA.Resource;
  deployment: SCHEMA.Deployment;
};

const DropdownCell: React.FC<DropdownCellProps> = () => (
  <TableCell>
    <div className="flex justify-end"></div>
  </TableCell>
);

type ReleaseJobTriggerRowProps = {
  releaseJobTrigger?: ReleaseJobTrigger;
  version: SCHEMA.DeploymentVersion;
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
  version,
  environment,
  deployment,
  resource,
  isExpandable,
  isExpanded,
}) => {
  const router = useRouter();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const versionUrl = urls
    .workspace(workspaceSlug)
    .system(environment.system.slug)
    .deployment(deployment.slug)
    .release(version.id)
    .baseUrl();

  return (
    <TableRow
      key={releaseJobTrigger?.id ?? version.id}
      onClick={() => router.push(versionUrl)}
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
                <span className="truncate">{version.name}</span>
              </div>
            </CollapsibleTrigger>
          </div>
        )}
        {!isExpandable && (
          <div className="flex">
            <span className="truncate pl-7">{version.name}</span>
          </div>
        )}
      </TableCell>
      <StatusCell
        releaseJobTrigger={releaseJobTrigger}
        versionId={version.id}
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
        version={version}
        environmentId={environment.id}
        deployment={deployment}
        resource={resource}
      />
    </TableRow>
  );
};

const ReleaseJobTriggerChildRow: React.FC<ReleaseJobTriggerRowProps> = ({
  releaseJobTrigger,
  version,
  environment,
  deployment,
  resource,
}) => {
  const router = useRouter();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const versionUrl = urls
    .workspace(workspaceSlug)
    .system(environment.system.slug)
    .deployment(deployment.slug)
    .release(version.id)
    .baseUrl();

  return (
    <TableRow
      key={releaseJobTrigger?.id ?? version.id}
      onClick={() => router.push(versionUrl)}
      className="cursor-pointer"
    >
      <TableCell />
      <StatusCell
        releaseJobTrigger={releaseJobTrigger}
        versionId={version.id}
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
        version={version}
        environmentId={environment.id}
        deployment={deployment}
        resource={resource}
      />
    </TableRow>
  );
};

type Version = RouterOutputs["deployment"]["version"]["list"]["items"][number];

type VersionRowsProps = {
  version: Version;
  environment: SCHEMA.Environment & { system: SCHEMA.System };
  deployment: SCHEMA.Deployment;
  resource: SCHEMA.Resource;
};

export const VersionRows: React.FC<VersionRowsProps> = ({
  version,
  environment,
  deployment,
  resource,
}) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { data: workspace } = api.workspace.bySlug.useQuery(workspaceSlug);

  const [open, setOpen] = useState(false);

  const isSameRelease: JobCondition = {
    type: JobConditionType.Release,
    operator: ColumnOperator.Equals,
    value: version.id,
  };

  const isSameResource: JobCondition = {
    type: JobConditionType.JobResource,
    operator: ColumnOperator.Equals,
    value: resource.id,
  };

  const isSameEnvironment: JobCondition = {
    type: JobConditionType.Environment,
    operator: ColumnOperator.Equals,
    value: environment.id,
  };

  const filter: JobCondition = {
    type: ConditionType.Comparison,
    operator: ComparisonOperator.And,
    conditions: [isSameRelease, isSameResource, isSameEnvironment],
  };

  const { data: releaseJobTriggers } =
    api.job.config.byWorkspaceId.list.useQuery(
      { workspaceId: workspace?.id ?? "", filter },
      { enabled: workspace != null },
    );

  const hasOtherReleaseJobTriggers =
    releaseJobTriggers != null && releaseJobTriggers.length > 1;

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <>
        <ReleaseJobTriggerParentRow
          version={version}
          environment={environment}
          deployment={deployment}
          resource={resource}
          releaseJobTrigger={releaseJobTriggers?.[0]}
          isExpandable={hasOtherReleaseJobTriggers}
          isExpanded={open}
          key={releaseJobTriggers?.[0]?.id ?? `${version.id}-parent`}
        />
        <CollapsibleContent asChild>
          <>
            {releaseJobTriggers?.map((trigger, idx) => {
              if (idx === 0) return null;
              return (
                <ReleaseJobTriggerChildRow
                  version={version}
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
