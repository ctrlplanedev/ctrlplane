import type { JobCondition } from "@ctrlplane/validators/jobs";
import React from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import LZString from "lz-string";
import prettyMilliseconds from "pretty-ms";

import { TableCell, TableRow } from "@ctrlplane/ui/table";
import { ColumnOperator } from "@ctrlplane/validators/conditions";
import { JobConditionType } from "@ctrlplane/validators/jobs";

import type { DeploymentStat } from "./types";
import { urls } from "~/app/urls";
import { StatusBadge } from "./StatusBadge";

interface DeploymentRowProps {
  deploymentStat: DeploymentStat;
}

export const DeploymentRow: React.FC<DeploymentRowProps> = ({
  deploymentStat,
}) => {
  const { workspaceSlug, systemSlug, environmentId } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
    environmentId: string;
  }>();
  const router = useRouter();

  const environmentCondition: JobCondition = {
    type: JobConditionType.Environment,
    value: environmentId,
    operator: ColumnOperator.Equals,
  };

  const conditionHash = LZString.compressToEncodedURIComponent(
    JSON.stringify(environmentCondition),
  );

  const deploymentVersionJobsUrl = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .deployment(deploymentStat.deployment.slug)
    .release(deploymentStat.deployment.version.id)
    .jobs();

  const urlWithSelector = `${deploymentVersionJobsUrl}?selector=${conditionHash}`;

  return (
    <TableRow
      key={deploymentStat.deployment.id}
      className="h-12 cursor-pointer border-b border-neutral-800/50 hover:bg-neutral-800/20"
      onClick={() => router.push(urlWithSelector)}
    >
      <TableCell className="truncate py-3 font-medium text-neutral-200">
        {deploymentStat.deployment.name}
      </TableCell>
      <TableCell className="truncate py-3 text-neutral-300">
        {deploymentStat.deployment.version.tag}
      </TableCell>
      <TableCell className="py-3">
        <StatusBadge status={deploymentStat.status} />
      </TableCell>
      <TableCell className="py-3 text-neutral-300">
        {deploymentStat.resourceCount}
      </TableCell>

      <TableCell className="truncate py-3 text-neutral-300">
        {prettyMilliseconds(deploymentStat.duration, { compact: true })}
      </TableCell>
      <TableCell className="truncate py-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 rounded-full bg-neutral-800">
            <div
              className={`h-full rounded-full ${
                deploymentStat.successRate * 100 > 90
                  ? "bg-green-500"
                  : deploymentStat.successRate * 100 > 70
                    ? "bg-amber-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${Number(deploymentStat.successRate * 100)}%` }}
            />
          </div>
          <span className="text-sm">
            {Number(deploymentStat.successRate * 100).toFixed(1)}%
          </span>
        </div>
      </TableCell>
      <TableCell className="truncate py-3 text-neutral-300">
        {deploymentStat.deployedBy}
      </TableCell>
      <TableCell className="truncate py-3 text-sm text-neutral-400">
        {formatDistanceToNow(deploymentStat.deployedAt, {
          addSuffix: true,
        })}
      </TableCell>
    </TableRow>
  );
};
