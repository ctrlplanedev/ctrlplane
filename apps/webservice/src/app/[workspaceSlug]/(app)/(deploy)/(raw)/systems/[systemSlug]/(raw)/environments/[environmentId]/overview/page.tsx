import React from "react";
import { notFound } from "next/navigation";
import _ from "lodash";

import { api } from "~/trpc/server";
import { OverviewPageContent } from "./OverviewPageContent";

export default async function EnvironmentOverviewPage(props: {
  params: Promise<{ environmentId: string }>;
}) {
  const { environmentId } = await props.params;
  const environment = await api.environment.byId(environmentId);
  if (environment == null) return notFound();

  const { items: releaseTargets } = await api.releaseTarget.list({
    environmentId,
  });
  const deployments = _.chain(releaseTargets)
    .map((rt) => rt.deployment)
    .uniqBy((d) => d.id)
    .value();

  const resources = _.chain(releaseTargets)
    .map((rt) => rt.resource)
    .uniqBy((r) => r.id)
    .value();

  return (
    <OverviewPageContent
      environment={environment}
      deployments={deployments}
      resources={resources}
    />
  );
}
