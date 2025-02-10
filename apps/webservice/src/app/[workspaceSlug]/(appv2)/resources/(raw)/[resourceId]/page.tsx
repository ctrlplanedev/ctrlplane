import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { ResourceDeploymentsTable } from "./deployments/ResourceDeploymentTable";

type Params = Promise<{ resourceId: string }>;
type SearchParams = Promise<{ tab?: string }>;

export default async function ResourcePage(props: {
  params: Params;
  searchParams: SearchParams;
}) {
  const params = await props.params;
  const { resourceId } = params;

  const resource = await api.resource.byId(resourceId);
  if (resource == null) notFound();

  return <ResourceDeploymentsTable resource={resource} />;
}
