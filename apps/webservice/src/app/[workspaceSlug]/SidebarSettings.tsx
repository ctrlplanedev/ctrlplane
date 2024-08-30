import Link from "next/link";
import { TbBuilding, TbChevronLeft, TbUser } from "react-icons/tb";

import { SidebarLink } from "./SidebarLink";

const WorkspaceSettings: React.FC<{ workspaceSlug: string }> = ({
  workspaceSlug,
}) => {
  return (
    <div className="m-3 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <TbBuilding className="w-3" /> Workspace
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
        <TbUser className="w-3" /> My account
      </div>

      <div className="ml-3 space-y-0.5">
        <SidebarLink href={`/${workspaceSlug}/settings/account/profile`}>
          Profile
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
            <TbChevronLeft />
          </div>
          <div className="flex-grow">Settings</div>
        </Link>
      </div>

      <WorkspaceSettings workspaceSlug={workspaceSlug} />
      <AccountSettings workspaceSlug={workspaceSlug} />
    </div>
  );
};
