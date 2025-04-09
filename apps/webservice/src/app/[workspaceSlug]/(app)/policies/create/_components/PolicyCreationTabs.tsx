"use client";

import React from "react";
import { IconCircleFilled } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";

import type { PolicyTab } from "./PolicyContext";
import {
  BasicConfiguration,
  DeploymentFlow,
  QualitySecurity,
  TimeWindows,
} from ".";
import { usePolicyContext } from "./PolicyContext";

interface TabConfig {
  id: PolicyTab;
  label: string;
  description: string;
}

const POLICY_TABS: TabConfig[] = [
  {
    id: "config",
    label: "Policy Configuration",
    description: "Basic policy configuration",
  },
  {
    id: "time-windows",
    label: "Time Windows",
    description: "Schedule-based deployment rules",
  },
  {
    id: "deployment-flow",
    label: "Deployment Flow",
    description: "Control deployment progression",
  },
  {
    id: "quality-security",
    label: "Quality & Security",
    description: "Deployment safety measures",
  },
];

export const PolicyCreationTabs: React.FC = () => {
  const { activeTab, setActiveTab } = usePolicyContext();

  const renderTabContent = () => {
    switch (activeTab) {
      case "config":
        return <BasicConfiguration />;
      case "time-windows":
        return <TimeWindows />;
      case "deployment-flow":
        return <DeploymentFlow />;
      case "quality-security":
        return <QualitySecurity />;
    }
  };

  return (
    <div className="flex h-full w-full">
      <div className="sticky top-0 h-full w-64 flex-shrink-0 border-r">
        <div className="flex flex-col py-2">
          {POLICY_TABS.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex w-full cursor-pointer justify-start gap-3 p-3 text-muted-foreground",

                activeTab === tab.id
                  ? "bg-purple-500/10 text-purple-300"
                  : "hover:bg-purple-500/5 hover:text-purple-300",
              )}
            >
              <IconCircleFilled className="ml-4 mt-2 size-2" />
              <div className="space-y-1">
                <div>{tab.label}</div>
                <div
                  className={cn(
                    "text-xs",
                    activeTab === tab.id
                      ? "text-purple-300"
                      : "text-muted-foreground",
                  )}
                >
                  {tab.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full flex-grow">
        <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-full overflow-y-auto p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};
