import {
  IconHistory,
  IconInfoCircle,
  IconTopologyComplex,
} from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";

export enum ResourceDrawerSidebarTab {
  Overview = "overview",
  Systems = "systems",
  PipelineHistory = "pipeline-history",
}

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  Icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, Icon, label }) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "flex w-48 items-center justify-start gap-2 text-muted-foreground",
        active &&
          "bg-purple-500/10 text-purple-300 hover:!bg-purple-500/10 hover:!text-purple-300",
      )}
      onClick={onClick}
    >
      {Icon}
      {label}
    </Button>
  );
};

export const ResourceDrawerSidebarTabs: React.FC<{
  activeTab: ResourceDrawerSidebarTab;
  setActiveTab: (tab: ResourceDrawerSidebarTab) => void;
}> = ({ activeTab, setActiveTab }) => {
  return (
    <div className="space-y-1 border-r border-muted-foreground/20 p-2">
      <TabButton
        active={activeTab === ResourceDrawerSidebarTab.Overview}
        onClick={() => setActiveTab(ResourceDrawerSidebarTab.Overview)}
        Icon={<IconInfoCircle className="size-4" />}
        label="Overview"
      />
      <TabButton
        active={activeTab === ResourceDrawerSidebarTab.Systems}
        onClick={() => setActiveTab(ResourceDrawerSidebarTab.Systems)}
        Icon={<IconTopologyComplex className="size-4" />}
        label="Systems"
      />
      <TabButton
        active={activeTab === ResourceDrawerSidebarTab.PipelineHistory}
        onClick={() => setActiveTab(ResourceDrawerSidebarTab.PipelineHistory)}
        Icon={<IconHistory className="size-4" />}
        label="Pipeline History"
      />
    </div>
  );
};
