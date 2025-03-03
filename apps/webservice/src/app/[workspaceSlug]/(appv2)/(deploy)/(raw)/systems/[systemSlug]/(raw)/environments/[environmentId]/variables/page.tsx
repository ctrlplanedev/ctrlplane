import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { api } from "~/trpc/server";

export default async function VariablesPage(props: {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    environmentId: string;
  }>;
}) {
  const { workspaceSlug, systemSlug, environmentId } = await props.params;

  const variableSets = await api.variableSet.byEnvironmentId(environmentId);

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Key</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Variable Set</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {variableSets
          .map((v) =>
            v.variableSet.values.map((val) => (
              <TableRow key={val.id}>
                <TableCell>{val.key}</TableCell>
                <TableCell>{val.value}</TableCell>
                <TableCell>
                  <Link
                    href={`/${workspaceSlug}/systems/${systemSlug}/environments/${environmentId}/variables?variable_set_id=${v.variableSet.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {v.variableSet.name}
                  </Link>
                </TableCell>
              </TableRow>
            )),
          )
          .flat()}
      </TableBody>
    </Table>
  );
}
