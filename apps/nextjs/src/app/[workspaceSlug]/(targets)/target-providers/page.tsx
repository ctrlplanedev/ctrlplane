"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { api } from "~/trpc/react";
import { TargetProvidersGettingStarted } from "./TargetProvidersGettingStarted";

export default function TargetProvidersPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const { workspaceSlug } = params;
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const targetProviders = api.target.provider.byWorkspaceId.useQuery(
    workspace.data?.id ?? "",
    { enabled: workspace.isSuccess },
  );

  if (targetProviders.isSuccess && targetProviders.data.length === 0)
    return <TargetProvidersGettingStarted />;

  return (
    <div>
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {targetProviders.data?.map((provider) => (
            <TableRow
              key={provider.id}
              className="cursor-pointer border-b-neutral-800/50"
            >
              <TableCell>{provider.name}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
