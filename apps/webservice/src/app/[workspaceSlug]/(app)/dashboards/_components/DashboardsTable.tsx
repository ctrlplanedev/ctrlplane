"use client";

import type * as schema from "@ctrlplane/db/schema";
import { useParams, useRouter } from "next/navigation";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { urls } from "~/app/urls";

export const DashboardsTable: React.FC<{
  dashboards: schema.Dashboard[];
}> = ({ dashboards }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const router = useRouter();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead>Updated At</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dashboards.map((dashboard) => (
          <TableRow
            key={dashboard.id}
            className="cursor-pointer"
            onClick={() =>
              router.push(
                urls.workspace(workspaceSlug).dashboard(dashboard.id).baseUrl(),
              )
            }
          >
            <TableCell>{dashboard.name}</TableCell>
            <TableCell>{dashboard.createdAt.toLocaleString()}</TableCell>
            <TableCell>{dashboard.updatedAt?.toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
