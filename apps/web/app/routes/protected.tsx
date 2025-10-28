import { Navigate, Outlet, useLocation, useParams } from "react-router";

import { trpc } from "~/api/trpc";
import { EngineProvider } from "~/components/EngineProvider";
import { WorkspaceProvider } from "~/components/WorkspaceProvider";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

export default function ProtectedLayout() {
  const { data: viewer, isLoading } = trpc.user.session.useQuery();
  const workspaces = viewer?.workspaces ?? [];
  const location = useLocation();

  const { workspaceSlug } = useParams<{ workspaceSlug?: string }>();

  if (isLoading) return <LoadingScreen />;
  if (viewer == null) return <Navigate to="/login" replace />;

  const { activeWorkspaceId } = viewer;
  const workspace =
    workspaces.find((w) => w.slug === workspaceSlug) ??
    workspaces.find((w) => w.id === activeWorkspaceId) ??
    workspaces.at(0);

  if (workspace == null) return <Navigate to="/workspaces/create" replace />;

  if (!location.pathname.startsWith(`/${workspace.slug}`)) {
    return <Navigate to={`/${workspace.slug}/deployments`} replace />;
  }

  return (
    <WorkspaceProvider workspace={workspace}>
      <EngineProvider>
        <Outlet />
      </EngineProvider>
    </WorkspaceProvider>
  );
}
