"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  IconCategory,
  IconChevronRight,
  IconRocket,
  IconTarget,
} from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@ctrlplane/ui/collapsible";

import { SidebarLink } from "./SidebarLink";

export const SidebarWorkspace: React.FC = () => {
  const [open, setOpen] = useState(true);
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="m-3 space-y-2">
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground">
        Workspace
        <IconChevronRight
          className={cn("h-3 w-3", open && "rotate-90", "transition-all")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5 text-sm">
        {/* <SidebarLink href={`/${workspaceSlug}/dashboard`}>
          <IconDashboard className="text-muted-foreground" /> Dashboard
        </SidebarLink> */}
        <SidebarLink href={`/${workspaceSlug}/systems`} exact>
          <IconCategory className="h-4 w-4 text-muted-foreground" /> Systems
        </SidebarLink>
        <div className="ml-[15px] border-l">
          <div className="ml-2 space-y-0.5">
            <SidebarLink href={`/${workspaceSlug}/dependencies`}>
              Dependencies
            </SidebarLink>
          </div>
        </div>

        <SidebarLink href={`/${workspaceSlug}/targets`} hideActiveEffect>
          <IconTarget className="h-4 w-4 text-muted-foreground" /> Targets
        </SidebarLink>
        <div className="ml-[15px] border-l">
          <div className="ml-2 space-y-0.5">
            <SidebarLink href={`/${workspaceSlug}/targets`}>List</SidebarLink>
            <SidebarLink href={`/${workspaceSlug}/target-providers`}>
              Providers
            </SidebarLink>
            <SidebarLink href={`/${workspaceSlug}/target-metadata-groups`}>
              Groups
            </SidebarLink>
            <SidebarLink href={`/${workspaceSlug}/target-views`}>
              Views
            </SidebarLink>
          </div>
        </div>

        <SidebarLink href={`/${workspaceSlug}/job-agents`} hideActiveEffect>
          <IconRocket className="h-4 w-4 text-muted-foreground" /> Jobs
        </SidebarLink>
        <div className="ml-[15px] border-l">
          <div className="ml-2 space-y-0.5">
            <SidebarLink href={`/${workspaceSlug}/job-agents`}>
              Agents
            </SidebarLink>
            <SidebarLink href={`/${workspaceSlug}/jobs`}>Triggered</SidebarLink>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
