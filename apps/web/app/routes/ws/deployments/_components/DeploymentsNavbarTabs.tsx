import { Link } from "react-router";

import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useWorkspace } from "~/components/WorkspaceProvider";

export const DeploymentsNavbarTabs = ({
  deploymentId,
}: {
  deploymentId: string;
}) => {
  const { workspace } = useWorkspace();
  return (
    <Tabs value="environments">
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
        <TabsTrigger value="activity" asChild>
          <Link to={`/${workspace.slug}/deployments/${deploymentId}/activity`}>
            Activity
          </Link>
        </TabsTrigger>
        <TabsTrigger value="activity" asChild>
          <Link to={`/${workspace.slug}/deployments/${deploymentId}/settings`}>
            Settings
          </Link>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};
