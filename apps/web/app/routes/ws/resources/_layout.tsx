import { Outlet, useParams } from "react-router";

import { trpc } from "~/api/trpc";
import { Spinner } from "~/components/ui/spinner";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { ResourceProvider } from "./_components/ResourceProvider";

export default function ResourcesLayout() {
  const { identifier } = useParams();
  const { workspace } = useWorkspace();

  const decodedIdentifier = identifier ? decodeURIComponent(identifier) : "";

  const { data: resource, isLoading } = trpc.resource.get.useQuery(
    { workspaceId: workspace.id, identifier: decodedIdentifier },
    { enabled: identifier != null },
  );

  if (isLoading) {
    return <Spinner />;
  }

  if (resource == null) {
    throw new Error(`Resource not found with identifier: ${decodedIdentifier}`);
  }

  return (
    <ResourceProvider resource={resource}>
      <Outlet />
    </ResourceProvider>
  );
}
