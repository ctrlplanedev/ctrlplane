import { Navigate, Outlet, useParams } from "react-router";

import { api } from "~/trpc";

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
  const { data: viewer, isLoading: isViewerLoading } =
    api.user.viewer.useQuery();
  const { data: workspaces = [], isLoading: isWorkspacesLoading } =
    api.workspace.list.useQuery();

  const { workspaceSlug } = useParams<{ workspaceSlug?: string }>();

  const loading = isViewerLoading || isWorkspacesLoading;
  if (loading) return <LoadingScreen />;
  if (!viewer) return <Navigate to="/login" />;

  const activeWorkspaceId = viewer.activeWorkspaceId;
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  if (!activeWorkspace) return <Navigate to="/workspaces/create" />;

  if (activeWorkspace.slug !== workspaceSlug) {
    return <Navigate to={`/${activeWorkspace.slug}/deployments`} />;
  }

  return <Outlet />;
}
