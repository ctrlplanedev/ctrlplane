import type * as schema from "@ctrlplane/db/schema";
import { formatDistanceToNowStrict } from "date-fns";

import { TableCell, TableRow } from "@ctrlplane/ui/table";

import { JobStatusCell } from "./JobStatusCell";

export const JobRow: React.FC<{
  releaseTargetId: string;
  versionId: string;
  job: schema.Job;
}> = ({ releaseTargetId, versionId, job }) => (
  <TableRow className="h-[49px]">
    <TableCell />
    <TableCell />
    <JobStatusCell
      releaseTargetId={releaseTargetId}
      versionId={versionId}
      status={job.status}
    />
    <TableCell>
      {formatDistanceToNowStrict(job.createdAt, { addSuffix: true })}
    </TableCell>
    <TableCell />
  </TableRow>
);
