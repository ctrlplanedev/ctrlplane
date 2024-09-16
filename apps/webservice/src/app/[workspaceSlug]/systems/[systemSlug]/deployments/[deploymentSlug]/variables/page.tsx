import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { VariableTable } from "./VariableTable";

export default async function VariablesPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string; deploymentSlug: string };
}) {
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) notFound();
  const variables = await api.deployment.variable.byDeploymentId(deployment.id);
  return (
    <>
      <div className="h-full overflow-y-auto pb-[100px]">
        <div className="min-h-full">
          <VariableTable variables={variables} />
        </div>
      </div>
    </>
  );
}
