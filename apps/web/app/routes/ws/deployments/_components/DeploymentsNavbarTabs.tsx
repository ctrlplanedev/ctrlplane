import { Link, useLocation } from "react-router";

import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useDeployment } from "./DeploymentProvider";

export const DeploymentsNavbarTabs = () => {
  const { deployment } = useDeployment();
  const { workspace } = useWorkspace();
  const baseUrl = `/${workspace.slug}/deployments/${deployment.id}`;
  const path = useLocation();
  const value =
    path.pathname == `${baseUrl}`
      ? "environments"
      : path.pathname.startsWith(`${baseUrl}/resources`)
        ? "resources"
        : path.pathname.startsWith(`${baseUrl}/settings`)
          ? "settings"
          : path.pathname.startsWith(`${baseUrl}/release-targets`)
            ? "release-targets"
            : "versions";

  return (
    <Tabs value={value}>
      <TabsList>
        <TabsTrigger value="environments" asChild>
          <Link to={`${baseUrl}`}>Environments</Link>
        </TabsTrigger>
        <TabsTrigger value="resources" asChild>
          <Link to={`${baseUrl}/resources`}>Resources</Link>
        </TabsTrigger>
        <TabsTrigger value="versions" asChild>
          <Link to={`${baseUrl}/versions`}>Versions</Link>
        </TabsTrigger>
        <TabsTrigger value="release-targets" asChild>
          <Link to={`${baseUrl}/release-targets`}>Targets</Link>
        </TabsTrigger>
        <TabsTrigger value="settings" asChild>
          <Link to={`${baseUrl}/settings`}>Settings</Link>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};
