import { Outlet, useParams } from "react-router";

import { trpc } from "~/api/trpc";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { DeploymentProvider } from "./_components/DeploymentProvider";

export default function DeploymentsLayout() {
  const { workspace } = useWorkspace();
  const { deploymentId } = useParams();

  const { data: deployment } = trpc.deployment.get.useQuery(
    { workspaceId: workspace.id, deploymentId: deploymentId ?? "" },
    { enabled: deploymentId != null },
  );

  if (!deployment?.data) {
    throw new Error("Deployment not found");
  }

  return (
    <DeploymentProvider deployment={deployment.data}>
      {"TEST"}
      <Outlet />
    </DeploymentProvider>
  );
}
