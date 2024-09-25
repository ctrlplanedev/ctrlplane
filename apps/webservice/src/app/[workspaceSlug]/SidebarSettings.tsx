import Link from "next/link";
import { IconBuilding, IconChevronLeft, IconUser } from "@tabler/icons-react";

import { SidebarLink } from "./SidebarLink";

const WorkspaceSettings: React.FC<{ workspaceSlug: string }> = ({
  workspaceSlug,
}) => {
  return (
    <div className="m-3 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <IconBuilding className="w-3" /> Workspace
      </div>

      <div className="ml-3 space-y-0.5">
        <SidebarLink href={`/${workspaceSlug}/settings/workspace/overview`}>
          Overview
        </SidebarLink>
        <SidebarLink href={`/${workspaceSlug}/settings/workspace/general`}>
          General
        </SidebarLink>
        <SidebarLink href={`/${workspaceSlug}/settings/workspace/members`}>
          Members
        </SidebarLink>
        <SidebarLink href={`/${workspaceSlug}/settings/workspace/integrations`}>
          Integrations
        </SidebarLink>
      </div>
    </div>
  );
};

const AccountSettings: React.FC<{ workspaceSlug: string }> = ({
  workspaceSlug,
}) => {
  return (
    <div className="m-3 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <IconUser className="w-3" /> My account
      </div>

      <div className="ml-3 space-y-0.5">
        <SidebarLink href={`/${workspaceSlug}/settings/account/profile`}>
          Profile
        </SidebarLink>
        <SidebarLink href={`/${workspaceSlug}/settings/account/api`}>
          API
        </SidebarLink>
      </div>
    </div>
  );
};

export const SidebarSettings: React.FC<{ workspaceSlug: string }> = ({
  workspaceSlug,
}) => {
  return (
    <div className="space-y-6 text-sm">
      <div className="mx-3 my-4 space-y-4">
        <Link
          href={`/${workspaceSlug}`}
          className="flex w-full items-center gap-2 text-left hover:bg-transparent"
        >
          <div className="text-muted-foreground">
            <IconChevronLeft className="h-3 w-3" />
          </div>
          <div className="flex-grow">Settings</div>
        </Link>
      </div>

      <WorkspaceSettings workspaceSlug={workspaceSlug} />
      <AccountSettings workspaceSlug={workspaceSlug} />
    </div>
  );
};
