"use client";;
import { use } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { api } from "~/trpc/react";

const VariableRow: React.FC<{
  varKey: string;
  description: string;
  value?: string | null;
}> = ({ varKey, description, value }) => (
  <TableRow>
    <TableCell className="w-[500px] p-3">
      <div className="flex items-center gap-2">
        <div>{varKey}</div>
      </div>
      <div className="text-sm text-muted-foreground">{description}</div>
    </TableCell>
    <TableCell className="p-3">
      {value ?? <div className="italic text-neutral-500">NULL</div>}
    </TableCell>
  </TableRow>
);

export default function VariablePage(
  props: {
    params: Promise<{ resourceId: string }>;
  }
) {
  const params = use(props.params);

  const {
    resourceId
  } = params;

  const deployments = api.deployment.byResourceId.useQuery(resourceId);
  const variables = api.deployment.variable.byResourceId.useQuery(resourceId);
  return (
    <div className="">
      {deployments.data?.map((deployment) => {
        return (
          <div key={deployment.id} className="space-y-6 border-b p-24">
            <div className="text-lg font-semibold">{deployment.name}</div>

            <Table className="w-full">
              <TableHeader className="text-left">
                <TableRow className="text-sm">
                  <TableHead className="p-3">Keys</TableHead>
                  <TableHead className="p-3">Value</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {variables.data
                  ?.filter((v) => v.deploymentId === deployment.id)
                  .map((v) => (
                    <VariableRow
                      key={v.id}
                      varKey={v.key}
                      value={v.value.value}
                      description={v.description}
                    />
                  ))}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
}
