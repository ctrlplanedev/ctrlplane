"use client";

import type { System, Workspace } from "@ctrlplane/db/schema";
import { useState } from "react";
import { useParams } from "next/navigation";
import {
  TbChevronRight,
  TbPlant,
  TbPlus,
  TbRun,
  TbShip,
  TbVariable,
} from "react-icons/tb";
import { useLocalStorage } from "react-use";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@ctrlplane/ui/collapsible";

import { CreateSystemDialog } from "./_components/CreateSystem";
import { SidebarLink } from "./SidebarLink";

const SystemCollapsible: React.FC<{ system: System }> = ({ system }) => {
  const [open, setOpen] = useLocalStorage(
    `sidebar-systems-${system.id}`,
    "false",
  );
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  return (
    <Collapsible
      open={open === "true"}
      onOpenChange={() => setOpen(open === "true" ? "false" : "true")}
      className="space-y-1 text-sm"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1 hover:bg-neutral-800/50">
        {system.name}
        <TbChevronRight
          className={cn(
            "text-sm text-muted-foreground transition-all",
            open === "true" && "rotate-90",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-2">
        <SidebarLink
          href={`/${workspaceSlug}/systems/${system.slug}/deployments`}
        >
          <TbShip className="text-muted-foreground" /> Deployments
        </SidebarLink>
        <SidebarLink
          href={`/${workspaceSlug}/systems/${system.slug}/environments`}
        >
          <TbPlant className="text-muted-foreground" /> Environments
        </SidebarLink>
        <SidebarLink href={`/${workspaceSlug}/systems/${system.slug}/runbooks`}>
          <TbRun className="text-muted-foreground" /> Runbooks
        </SidebarLink>
        <SidebarLink
          href={`/${workspaceSlug}/systems/${system.slug}/variable-sets`}
        >
          <TbVariable className="text-muted-foreground" /> Variable Sets
        </SidebarLink>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const SidebarSystems: React.FC<{
  workspace: Workspace;
  systems: System[];
}> = ({ workspace, systems }) => {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="m-3 space-y-2">
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground">
        Your systems
        <TbChevronRight className={cn(open && "rotate-90", "transition-all")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1">
        {systems.length === 0 && (
          <CreateSystemDialog workspace={workspace}>
            <Button
              className="flex w-full items-center justify-start gap-1.5 text-left"
              variant="ghost"
              size="sm"
            >
              <TbPlus /> New system
            </Button>
          </CreateSystemDialog>
        )}
        {systems.map((system) => (
          <SystemCollapsible key={system.id} system={system} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};
