import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { ResourceDeploymentsTable } from "./ResourceDeploymentTable";

type Params = Promise<{ resourceId: string }>;

export default async function DeploymentsPage(props: { params: Params }) {
  const { resourceId } = await props.params;
  const resource = await api.resource.byId(resourceId);
  if (resource == null) notFound();

  return <ResourceDeploymentsTable resource={resource} />;
}
