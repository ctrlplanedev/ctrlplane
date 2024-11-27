import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { ReleaseRows } from "./TableRow";

type ReleaseWithTriggers =
  RouterOutputs["job"]["config"]["byDeploymentEnvAndResource"][number];

type ReleaseTableProps = {
  releasesWithTriggers: ReleaseWithTriggers[];
  environment: SCHEMA.Environment & { system: SCHEMA.System };
  deployment: SCHEMA.Deployment;
  resource: SCHEMA.Resource;
};

export const ReleaseTable: React.FC<ReleaseTableProps> = ({
  releasesWithTriggers,
  environment,
  deployment,
  resource,
}) => (
  <div className="rounded-md border border-neutral-800">
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead>Release</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Links</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {releasesWithTriggers.map((release) => (
          <ReleaseRows
            release={release}
            environment={environment}
            deployment={deployment}
            resource={resource}
            key={release.id}
          />
        ))}
        {releasesWithTriggers.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={5}
              className="text-center text-muted-foreground"
            >
              No releases found
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  </div>
);
