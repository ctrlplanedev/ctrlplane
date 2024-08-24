import type { Metadata } from "next";

import { api } from "~/trpc/server";
import DeploymentTable from "./TableDeployments";

export const metadata: Metadata = { title: "Systems - Deployments" };

export default async function SystemDeploymentsPage({
  params,
}: {
  params: { systemSlug: string };
}) {
  const system = (await api.system.bySlug(params.systemSlug))!;
  const deployments = await api.deployment.bySystemId(system.id);
  const environments = await api.environment.bySystemId(system.id);
  return (
    <div className="container mx-auto p-8">
      <DeploymentTable
        deployments={deployments}
        environments={environments}
        systemSlug={params.systemSlug}
      />
    </div>
  );
}
