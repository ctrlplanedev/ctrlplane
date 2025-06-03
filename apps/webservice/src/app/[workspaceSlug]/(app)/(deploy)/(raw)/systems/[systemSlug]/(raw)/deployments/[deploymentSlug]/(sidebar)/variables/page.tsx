import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { VariableTable } from "./VariableTable";

type PageProps = {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();

  return {
    title: `Variables | ${deployment.name} | ${deployment.system.name}`,
    description: `Manage variables for ${deployment.name} deployment`,
  };
}

export default async function VariablesPage(props: {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>;
}) {
  const params = await props.params;
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) notFound();

  const variablesResult = await api.deployment.variable.byDeploymentId(
    deployment.id,
  );
  const variables = variablesResult.map((variable) => ({
    ...variable,
    values: [...variable.directValues, ...variable.referenceValues],
  }));

  return (
    <div className="h-full overflow-y-auto pb-[100px]">
      <div className="min-h-full">
        <VariableTable variables={variables} />
      </div>
    </div>
  );
}
