import { Navigate, Outlet, useParams } from "react-router";

import { trpc } from "~/api/trpc";

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

  const { workspaceSlug } = useParams<{ workspaceSlug?: string }>();

  if (isLoading) return <LoadingScreen />;
  if (viewer == null) return <Navigate to="/login" />;

  const { activeWorkspaceId } = viewer;
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  if (!activeWorkspace) return <Navigate to="/workspaces/create" />;

  if (activeWorkspace.slug !== workspaceSlug) {
    return <Navigate to={`/${activeWorkspace.slug}/deployments`} />;
  }

  return <Outlet />;
}
