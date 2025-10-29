import { Link, useLocation } from "react-router";

import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useWorkspace } from "~/components/WorkspaceProvider";

type PolicyTab = "general";

const usePolicyTab = (baseUrl: string): PolicyTab => {
  const { pathname } = useLocation();
  if (pathname === baseUrl) return "general";
  return "general";
};

export const PoliciesNavbarTabs = () => {
  const { workspace } = useWorkspace();
  const baseUrl = `/${workspace.slug}/policies/create`;
  const value = usePolicyTab(baseUrl);

  return (
    <Tabs value={value}>
      <TabsList>
        <TabsTrigger value="general" asChild>
          <Link to={`${baseUrl}`}>General</Link>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};
