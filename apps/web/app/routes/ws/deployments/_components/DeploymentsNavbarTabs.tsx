import { Link, useLocation } from "react-router";

import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useDeployment } from "./DeploymentProvider";

type DeploymentTab =
  | "environments"
  | "resources"
  | "settings"
  | "release-targets"
  | "versions";

const useDeploymentTab = (baseUrl: string): DeploymentTab => {
  const { pathname } = useLocation();
  if (pathname === baseUrl) return "environments";
  if (pathname.startsWith(`${baseUrl}/resources`)) return "resources";
  if (pathname.startsWith(`${baseUrl}/settings`)) return "settings";
  if (pathname.startsWith(`${baseUrl}/release-targets`))
    return "release-targets";
  return "versions";
};

export const DeploymentsNavbarTabs = () => {
  const { deployment } = useDeployment();
  const { workspace } = useWorkspace();
  const baseUrl = `/${workspace.slug}/deployments/${deployment.id}`;
  const value = useDeploymentTab(baseUrl);

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
