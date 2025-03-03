import { DeploymentsCard } from "~/app/[workspaceSlug]/(appv2)/_components/deployments/Card";

export default async function DeploymentsPage(props: {
  params: Promise<{ environmentId: string }>;
}) {
  const { environmentId } = await props.params;

  return (
    <div className="container m-8 mx-auto">
      <DeploymentsCard environmentId={environmentId} />
    </div>
  );
}
