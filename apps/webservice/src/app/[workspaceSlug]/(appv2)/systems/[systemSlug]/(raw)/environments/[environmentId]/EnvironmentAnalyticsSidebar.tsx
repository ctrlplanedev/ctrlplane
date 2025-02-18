import { Sidebar, SidebarContent, SidebarGroup } from "@ctrlplane/ui/sidebar";

import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { DailyResourceCountGraph } from "./resources/DailyResourcesCountGraph";

export const EnvironmentAnalyticsSidebar: React.FC<{
  environmentId: string;
}> = ({ environmentId }) => (
  <Sidebar
    className="absolute right-0 top-0 flex-1 border-0"
    side="right"
    style={{ "--sidebar-width": "500px" } as React.CSSProperties}
    name={Sidebars.EnvironmentAnalytics}
    gap="w-[500px]"
  >
    <SidebarContent>
      <SidebarGroup>
        <div className="flex flex-col gap-4 p-2">
          Daily resource Count
          <DailyResourceCountGraph environmentId={environmentId} />
        </div>
      </SidebarGroup>
    </SidebarContent>
  </Sidebar>
);
