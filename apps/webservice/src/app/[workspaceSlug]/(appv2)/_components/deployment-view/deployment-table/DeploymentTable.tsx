import type { RouterOutputs } from "@ctrlplane/api";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";
import { StatsColumn } from "@ctrlplane/validators/deployments";

import { DeploymentRow } from "./DeploymentRow";
import { SkeletonRow } from "./SkeletonRow";
import { TableHeadCell } from "./TableHeadCell";

type DeploymentTableProps = {
  data?: RouterOutputs["deployment"]["stats"]["byWorkspaceId"];
  isLoading: boolean;
};

export const DeploymentTable: React.FC<DeploymentTableProps> = ({
  data,
  isLoading,
}) => {
  return (
    <Table>
      <TableHeader>
        <TableRow className="h-16 hover:bg-transparent">
          <TableHead className="p-4">
            <TableHeadCell title="Workflow" orderByKey={StatsColumn.Name} />
          </TableHead>

          <TableHead className="w-[75px] p-4 xl:w-[150px]">
            <TableHeadCell
              title="Total Jobs"
              orderByKey={StatsColumn.TotalJobs}
            />
          </TableHead>

          <TableHead className="p-4">
            <TableHeadCell
              title="Resources"
              orderByKey={StatsColumn.AssociatedResources}
            />
          </TableHead>

          <TableHead className="p-4">History (30 days)</TableHead>

          <TableHead className="w-[75px] p-4 xl:w-[150px]">
            <TableHeadCell title="P50 Duration" orderByKey={StatsColumn.P50} />
          </TableHead>

          <TableHead className="w-[75px] p-4 xl:w-[150px]">
            <TableHeadCell title="P90 Duration" orderByKey={StatsColumn.P90} />
          </TableHead>

          <TableHead className="w-[140px] p-4">
            <TableHeadCell
              title="Success Rate"
              orderByKey={StatsColumn.SuccessRate}
            />
          </TableHead>
          <TableHead className="hidden p-4 xl:table-cell xl:w-[120px]">
            <TableHeadCell
              title="Last Run"
              orderByKey={StatsColumn.LastRunAt}
            />
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {!isLoading &&
          data?.map((deployment) => (
            <DeploymentRow key={deployment.id} deployment={deployment} />
          ))}
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <SkeletonRow key={i} index={i} />
          ))}
      </TableBody>
    </Table>
  );
};
