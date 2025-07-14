import { IconPin } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import type { ReleaseTargetModuleInfo } from "./release-target-module-info";
import { api } from "~/trpc/react";

export const VersionsTable: React.FC<{
  releaseTarget: ReleaseTargetModuleInfo;
}> = ({ releaseTarget }) => {
  const { data } =
    api.dashboard.widget.data.releaseTargetModule.deployableVersions.useQuery({
      releaseTargetId: releaseTarget.id,
    });

  const versions = data ?? [];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tag</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Created</TableHead>
          <TableCell />
        </TableRow>
      </TableHeader>
      <TableBody>
        {versions.map((version) => (
          <TableRow key={version.id}>
            <TableCell>{version.tag}</TableCell>
            <TableCell>{version.name}</TableCell>
            <TableCell>{version.createdAt.toLocaleString()}</TableCell>
            <TableCell>
              <Button size="sm" className="flex h-7 items-center gap-1">
                <IconPin className="h-4 w-4" />
                Pin
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
