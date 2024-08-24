import { notFound } from "next/navigation";
import { TbTarget } from "react-icons/tb";

import { Badge } from "@ctrlplane/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { api } from "~/trpc/server";
import { PieTargetsByKind, PieTargetsByProvider } from "./TargetCharts";

export default async function EnvironmentPage({
  params,
}: {
  params: { environmentId: string };
}) {
  const environment = await api.environment.byId(params.environmentId);
  if (environment == null) notFound();

  const targets = await api.environment.target.byEnvironmentId(
    params.environmentId,
  );

  return (
    <>
      <div className="border-b p-4 px-8 text-xl">{environment.name}</div>

      <div className="space-y-4 p-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          Targets{" "}
          <Badge variant="secondary" className="rounded-full">
            {targets.length}
          </Badge>
        </h2>
        <div className="grid grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-sm">
                Kind <TbTarget />
              </CardTitle>
            </CardHeader>
            <CardContent className="">
              <PieTargetsByKind targets={targets} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-sm">
                Providers <TbTarget />
              </CardTitle>
            </CardHeader>
            <CardContent className="">
              <PieTargetsByProvider targets={targets} />
            </CardContent>
          </Card>
        </div>
        <Card className="">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Provider</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.map((target) => (
                <TableRow key={target.id}>
                  <TableCell>{target.name}</TableCell>
                  <TableCell>
                    {target.provider?.name} / {target.kind}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
