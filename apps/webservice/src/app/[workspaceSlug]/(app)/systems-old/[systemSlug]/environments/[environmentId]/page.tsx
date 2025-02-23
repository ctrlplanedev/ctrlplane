import { notFound } from "next/navigation";
import { IconTarget } from "@tabler/icons-react";

import { Badge } from "@ctrlplane/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";

import { api } from "~/trpc/server";
import { PieResourcesByKind, PieResourcesByProvider } from "./ResourceCharts";

export default async function EnvironmentPage(props: {
  params: Promise<{ environmentId: string }>;
}) {
  const params = await props.params;
  const environment = await api.environment.byId(params.environmentId);
  if (environment == null) notFound();

  return (
    <>
      <div className="border-b p-4 px-8 text-xl">{environment.name}</div>

      <div className="space-y-4 p-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          Resources{" "}
          <Badge variant="secondary" className="rounded-full">
            {0}
          </Badge>
        </h2>
        <div className="grid grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-sm">
                Kind <IconTarget className="h-4 w-4" />
              </CardTitle>
            </CardHeader>
            <CardContent className="">
              <PieResourcesByKind resources={[]} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-sm">
                Providers <IconTarget className="h-4 w-4" />
              </CardTitle>
            </CardHeader>
            <CardContent className="">
              <PieResourcesByProvider resources={[]} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
