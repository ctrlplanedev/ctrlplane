import type * as schema from "@ctrlplane/db/schema";
import { capitalCase } from "change-case";

import { TableCell } from "@ctrlplane/ui/table";

import { JobTableStatusIcon } from "~/app/[workspaceSlug]/(app)/_components/job/JobTableStatusIcon";
import { PolicyEvaluationTooltip } from "~/app/[workspaceSlug]/(app)/(deploy)/(raw)/systems/[systemSlug]/(raw)/deployments/[deploymentSlug]/(raw)/releases/[releaseId]/(sidebar)/jobs/_components/PolicyEvaluationTooltip";

export const JobStatusCell: React.FC<{
  releaseTargetId: string;
  versionId: string;
  status: schema.JobStatus;
}> = ({ releaseTargetId, versionId, status }) => (
  <TableCell className="w-26">
    <PolicyEvaluationTooltip
      releaseTargetId={releaseTargetId}
      versionId={versionId}
    >
      <div className="flex w-fit items-center gap-1">
        <JobTableStatusIcon status={status} />
        {capitalCase(status)}
      </div>
    </PolicyEvaluationTooltip>
  </TableCell>
);
