"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  TbCategory,
  TbChevronRight,
  TbDashboard,
  TbRocket,
  TbTarget,
} from "react-icons/tb";

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
        <TbChevronRight className={cn(open && "rotate-90", "transition-all")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5 text-sm">
        <SidebarLink href={`/${workspaceSlug}/dashboard`}>
          <TbDashboard className="text-muted-foreground" /> Dashboard
        </SidebarLink>
        <SidebarLink href={`/${workspaceSlug}/systems`} exact>
          <TbCategory className="text-mutesd-foreground" /> Systems
        </SidebarLink>
        <div className="ml-3.5 border-l">
          <div className="ml-2 space-y-0.5">
            <SidebarLink href={`/${workspaceSlug}/dependencies`}>
              Dependencies
            </SidebarLink>
          </div>
        </div>

        <SidebarLink href={`/${workspaceSlug}/targets`} hideActiveEffect>
          <TbTarget className="text-muted-foreground" /> Targets
        </SidebarLink>
        <div className="ml-3.5 border-l">
          <div className="ml-2 space-y-0.5">
            <SidebarLink href={`/${workspaceSlug}/targets`}>List</SidebarLink>
            <SidebarLink href={`/${workspaceSlug}/target-providers`}>
              Providers
            </SidebarLink>
            <SidebarLink href={`/${workspaceSlug}/target-label-groups`}>
              Groups
            </SidebarLink>
          </div>
        </div>

        <SidebarLink href={`/${workspaceSlug}/job-agents`} hideActiveEffect>
          <TbRocket className="text-muted-foreground" /> Jobs
        </SidebarLink>
        <div className="ml-3.5 border-l">
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
