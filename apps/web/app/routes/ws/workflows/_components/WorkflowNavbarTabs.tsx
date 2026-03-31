import { Link, useLocation, useParams } from "react-router";

import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useWorkspace } from "~/components/WorkspaceProvider";

type WorkflowTab = "runs" | "settings";

const useWorkflowTab = (baseUrl: string): WorkflowTab => {
  const { pathname } = useLocation();
  if (pathname.startsWith(`${baseUrl}/settings`)) return "settings";
  return "runs";
};

export const WorkflowNavbarTabs: React.FC = () => {
  const { workspace } = useWorkspace();
  const { workflowId } = useParams<{ workflowId: string }>();
  const baseUrl = `/${workspace.slug}/workflows/${workflowId}`;
  const value = useWorkflowTab(baseUrl);

  return (
    <Tabs value={value}>
      <TabsList>
        <TabsTrigger value="runs" asChild>
          <Link to={baseUrl}>Runs</Link>
        </TabsTrigger>
        <TabsTrigger value="settings" asChild>
          <Link to={`${baseUrl}/settings`}>Settings</Link>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};
