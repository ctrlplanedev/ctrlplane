import type * as SCHEMA from "@ctrlplane/db/schema";
import type { NodeProps } from "reactflow";
import React from "react";
import { Handle, Position } from "reactflow";
import colors from "tailwindcss/colors";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { api } from "~/trpc/react";

type EnvironmentNodeProps = NodeProps<
  SCHEMA.Environment & { label: string; release: SCHEMA.DeploymentVersion }
>;

export const EnvironmentNode: React.FC<EnvironmentNodeProps> = (node) => {
  const { data } = node;
  const releaseJobTriggers = api.job.config.byReleaseId.useQuery(
    { releaseId: data.release.id },
    { refetchInterval: 10_000 },
  );
  const environmentJobs = releaseJobTriggers.data?.filter(
    (job) => job.environmentId === data.id,
  );
  const successful = environmentJobs?.filter(
    (job) => job.job.status === JobStatus.Successful,
  );
  return (
    <>
      <div
        className={cn(
          "flex w-[250px] items-center justify-between gap-2 rounded-md border bg-neutral-900 px-2.5 py-1",
        )}
      >
        {data.label}

        {releaseJobTriggers.data != null && (
          <Badge
            variant="outline"
            className="rounded-md text-xs text-muted-foreground"
          >
            {successful?.length} / {environmentJobs?.length}
          </Badge>
        )}
      </div>

      <Handle
        type="target"
        className="h-2 w-2 rounded-full border border-neutral-500"
        style={{ background: colors.neutral[800] }}
        position={Position.Left}
      />
      <Handle
        type="source"
        className="h-2 w-2 rounded-full border border-neutral-500"
        style={{ background: colors.neutral[800] }}
        position={Position.Right}
      />
    </>
  );
};
