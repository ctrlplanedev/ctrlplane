import Link from "next/link";
import { useParams } from "next/navigation";
import { IconLoader2 } from "@tabler/icons-react";
import { formatDistanceToNowStrict } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

type Version = {
  id: string;
  tag: string;
  name: string;
  createdAt: Date;
};
const DeployableVersionRow: React.FC<{ version: Version }> = ({ version }) => {
  const { workspaceSlug, systemSlug, deploymentSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>();

  const versionUrl = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .deployment(deploymentSlug)
    .release(version.id)
    .jobs();
  return (
    <TableRow>
      <TableCell className="max-w-[200px] truncate">
        <Link href={versionUrl} className="hover:underline">
          {version.tag}
        </Link>
      </TableCell>
      <TableCell className="max-w-[200px] truncate">{version.name}</TableCell>
      <TableCell>
        {formatDistanceToNowStrict(version.createdAt, { addSuffix: true })}
      </TableCell>
    </TableRow>
  );
};

const DeployableVersionTableHeader: React.FC = () => (
  <TableHeader>
    <TableRow>
      <TableHead>Tag</TableHead>
      <TableHead>Name</TableHead>
      <TableHead>Created</TableHead>
    </TableRow>
  </TableHeader>
);

export const DeployableVersionsTable: React.FC<{
  releaseTargetId: string;
}> = ({ releaseTargetId }) => {
  const { data, isLoading } =
    api.dashboard.widget.data.releaseTargetModule.deployableVersions.useQuery({
      releaseTargetId,
      limit: 30,
    });

  return (
    <div className="space-y-4">
      <span className="text-medium flex items-center gap-2">
        Deployable versions{" "}
        {isLoading && <IconLoader2 className="h-4 w-4 animate-spin" />}
      </span>
      {data != null && (
        <div className="rounded-md border">
          <Table>
            <DeployableVersionTableHeader />
            <TableBody>
              {data.map((v) => (
                <DeployableVersionRow key={v.id} version={v} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
