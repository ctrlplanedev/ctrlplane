import { Outlet, useParams } from "react-router";

import { trpc } from "~/api/trpc";
import { Spinner } from "~/components/ui/spinner";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { EnvironmentProvider } from "./_components/EnvironmentProvider";

export default function EnvironmentsLayout() {
  const { environmentId } = useParams();
  const { workspace } = useWorkspace();

  const { data: environment, isLoading } = trpc.environment.get.useQuery(
    { workspaceId: workspace.id, environmentId: environmentId ?? "" },
    { enabled: environmentId != null },
  );

  if (isLoading) {
    return <Spinner />;
  }

  if (environment == null) {
    throw new Error("Environment not found");
  }

  return (
    <EnvironmentProvider environment={environment}>
      <Outlet />
    </EnvironmentProvider>
  );
}
