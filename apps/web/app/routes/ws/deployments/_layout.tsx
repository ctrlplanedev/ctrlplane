import { Outlet, useParams } from "react-router";

import { trpc } from "~/api/trpc";
import { Spinner } from "~/components/ui/spinner";
import { DeploymentProvider } from "./_components/DeploymentProvider";

export default function DeploymentsLayout() {
  const { deploymentId } = useParams();

  const { data: deployment, isLoading } = trpc.deployment.get.useQuery(
    { deploymentId: deploymentId ?? "" },
    { enabled: deploymentId != null },
  );

  if (isLoading) {
    return <Spinner />;
  }

  if (deployment == null) {
    throw new Error("Deployment not found");
  }

  return (
    <DeploymentProvider deployment={deployment}>
      <Outlet />
    </DeploymentProvider>
  );
}
