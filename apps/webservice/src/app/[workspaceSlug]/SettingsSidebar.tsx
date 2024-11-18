import type { Workspace } from "@ctrlplane/db/schema";
import Link from "next/link";
import { IconChevronLeft } from "@tabler/icons-react";

import { Sidebar, SidebarContent, SidebarHeader } from "@ctrlplane/ui/sidebar";

import { SidebarNavMain } from "./SidebarNavMain";

export const SettingsSidebar: React.FC<{ workspace: Workspace }> = ({
  workspace,
}) => {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="mx-3 my-4 space-y-4">
          <Link
            href={`/${workspace.slug}`}
            className="flex w-full items-center gap-2 text-left hover:bg-transparent"
          >
            <div className="text-muted-foreground">
              <IconChevronLeft className="h-3 w-3" />
            </div>
            <div className="flex-grow">Settings</div>
          </Link>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarNavMain
          title="Workspace"
          items={[
            { title: "Overview", url: "#" },
            { title: "General", url: "#" },
            { title: "Members", url: "#" },
            { title: "Integrations", url: "#" },
          ]}
        />
        <SidebarNavMain
          title="User"
          items={[
            { title: "Profile", url: "#" },
            { title: "API Keys", url: "#" },
          ]}
        />
      </SidebarContent>
    </Sidebar>
  );
};
