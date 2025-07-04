import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { RolloutCurveChart } from "./_components/RolloutCurve";
import { RolloutDistributionCard } from "./_components/RolloutDistributionCard";
import { RolloutPercentCard } from "./_components/RolloutPercentCard";

export default async function EnvironmentVersionPage(props: {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
    releaseId: string;
    environmentId: string;
  }>;
}) {
  const params = await props.params;
  const version = await api.deployment.version.byId(params.releaseId);
  if (version == null) notFound();

  const environment = await api.environment.byId(params.environmentId);
  if (environment == null) notFound();

  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) notFound();

  return (
    <div className="container flex max-w-5xl flex-col gap-4 p-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">Gratual rollout</h2>
        <p className="text-sm text-muted-foreground">
          Rollout out the version {version.tag} to the environment{" "}
          {environment.name}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-1">
          <RolloutDistributionCard deploymentId={deployment.id} />
        </div>
        <div className="col-span-1">
          <RolloutPercentCard />
        </div>
      </div>
      <RolloutCurveChart />
    </div>
  );
}
