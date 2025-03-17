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

import { VersionRows } from "./TableRow";

type VersionWithTriggers =
  RouterOutputs["deployment"]["version"]["list"]["items"][number];

type ReleaseTableProps = {
  versionsWithTriggers: VersionWithTriggers[];
  environment: SCHEMA.Environment & { system: SCHEMA.System };
  deployment: SCHEMA.Deployment;
  resource: SCHEMA.Resource;
};

export const DeploymentVersionTable: React.FC<ReleaseTableProps> = ({
  versionsWithTriggers,
  environment,
  deployment,
  resource,
}) => (
  <div className="rounded-md border border-neutral-800">
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead>Version</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Links</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {versionsWithTriggers.map((version) => (
          <VersionRows
            version={version}
            environment={environment}
            deployment={deployment}
            resource={resource}
            key={version.id}
          />
        ))}
        {versionsWithTriggers.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={5}
              className="text-center text-muted-foreground"
            >
              No versions deployed
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  </div>
);
