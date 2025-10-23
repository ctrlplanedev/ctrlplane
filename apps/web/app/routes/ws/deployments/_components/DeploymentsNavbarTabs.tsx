import { Link, useLocation } from "react-router";

import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useWorkspace } from "~/components/WorkspaceProvider";

export const DeploymentsNavbarTabs = ({
  deploymentId,
}: {
  deploymentId: string;
}) => {
  const { workspace } = useWorkspace();
  const baseUrl = `/${workspace.slug}/deployments/${deploymentId}`;
  const path = useLocation();
  const value =
    path.pathname == `${baseUrl}`
      ? "environments"
      : path.pathname.startsWith(`${baseUrl}/settings`)
        ? "settings"
        : "versions";

  return (
    <Tabs value={value}>
      <TabsList>
        <TabsTrigger value="environments" asChild>
          <Link to={`/${workspace.slug}/deployments/${deploymentId}`}>
            Environments
          </Link>
        </TabsTrigger>
        <TabsTrigger value="versions" asChild>
          <Link to={`/${workspace.slug}/deployments/${deploymentId}/versions`}>
            Versions
          </Link>
        </TabsTrigger>
        <TabsTrigger value="settings" asChild>
          <Link to={`/${workspace.slug}/deployments/${deploymentId}/settings`}>
            Settings
          </Link>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};
