import type { RouterOutputs } from "@ctrlplane/api";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";
import { StatsColumn } from "@ctrlplane/validators/deployments";

import { TableSortHeader } from "~/app/[workspaceSlug]/(app)/_components/TableSortHeader";
import { DeploymentRow } from "./DeploymentRow";
import { SkeletonRow } from "./SkeletonRow";

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
            <TableSortHeader orderByKey={StatsColumn.Name}>
              Deployment
            </TableSortHeader>
          </TableHead>

          <TableHead className="w-[75px] p-4 xl:w-[150px]">
            <TableSortHeader orderByKey={StatsColumn.TotalJobs}>
              Total Jobs
            </TableSortHeader>
          </TableHead>

          <TableHead className="p-4">
            <TableSortHeader orderByKey={StatsColumn.AssociatedResources}>
              Resources
            </TableSortHeader>
          </TableHead>

          <TableHead className="p-4">History (30 days)</TableHead>

          <TableHead className="w-[75px] p-4 xl:w-[150px]">
            <TableSortHeader orderByKey={StatsColumn.P50}>
              P50 Duration
            </TableSortHeader>
          </TableHead>

          <TableHead className="w-[75px] p-4 xl:w-[150px]">
            <TableSortHeader orderByKey={StatsColumn.P90}>
              P90 Duration
            </TableSortHeader>
          </TableHead>

          <TableHead className="w-[140px] p-4">
            <TableSortHeader orderByKey={StatsColumn.SuccessRate}>
              Success Rate
            </TableSortHeader>
          </TableHead>
          <TableHead className="hidden p-4 xl:table-cell xl:w-[120px]">
            <TableSortHeader orderByKey={StatsColumn.LastRunAt}>
              Last Run
            </TableSortHeader>
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
