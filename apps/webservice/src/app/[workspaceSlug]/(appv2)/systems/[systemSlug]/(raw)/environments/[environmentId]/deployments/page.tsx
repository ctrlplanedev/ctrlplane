import { DeploymentsCard } from "~/app/[workspaceSlug]/(appv2)/_components/deployments/Card";

export default async function DeploymentsPage(props: {
  params: Promise<{ environmentId: string }>;
}) {
  const { environmentId } = await props.params;

  return <DeploymentsCard environmentId={environmentId} />;
}
