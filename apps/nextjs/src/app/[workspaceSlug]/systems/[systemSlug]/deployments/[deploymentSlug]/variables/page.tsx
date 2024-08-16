"use client";

import { api } from "~/trpc/react";
import { VariableTable } from "./VariableTable";

export default function VariablesPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string; deploymentSlug: string };
}) {
  const deployment = api.deployment.bySlug.useQuery(params);
  const variables = api.deployment.variable.byDeploymentId.useQuery(
    deployment.data?.id ?? "",
    { enabled: deployment.isSuccess },
  );
  return (
    <div>
      <VariableTable variables={variables.data ?? []} />

      <div className="container mx-auto p-8"></div>
    </div>
  );
}
