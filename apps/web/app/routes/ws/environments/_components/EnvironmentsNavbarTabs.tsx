import { Link, useLocation } from "react-router";

import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useWorkspace } from "~/components/WorkspaceProvider";

export const EnvironmentsNavbarTabs = ({
  environmentId,
}: {
  environmentId: string;
}) => {
  const { workspace } = useWorkspace();
  const baseUrl = `/${workspace.slug}/environments/${environmentId}`;
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
          <Link to={`/${workspace.slug}/environments/${environmentId}`}>
            Deployments
          </Link>
        </TabsTrigger>
        <TabsTrigger value="versions" asChild>
          <Link
            to={`/${workspace.slug}/environments/${environmentId}/resources`}
          >
            Resources
          </Link>
        </TabsTrigger>
        <TabsTrigger value="settings" asChild>
          <Link
            to={`/${workspace.slug}/environments/${environmentId}/settings`}
          >
            Settings
          </Link>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};
