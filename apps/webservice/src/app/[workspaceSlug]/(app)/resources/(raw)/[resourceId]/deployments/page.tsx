import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { ReleaseHistoryTable } from "./_components/ReleaseHistoryTable";

type Params = Promise<{ resourceId: string }>;

export default async function DeploymentsPage(props: { params: Params }) {
  const { resourceId } = await props.params;

  const { items: releaseTargets } = await api.releaseTarget.list({
    resourceId,
  });

  const resource = await api.resource.byId(resourceId);
  if (resource == null) notFound();

  return (
    <ReleaseHistoryTable
      resource={resource}
      deployments={releaseTargets.map((rt) => rt.deployment)}
    />
  );
}
