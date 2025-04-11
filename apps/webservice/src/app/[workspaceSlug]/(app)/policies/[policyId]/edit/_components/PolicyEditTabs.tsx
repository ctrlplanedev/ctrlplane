"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { IconCircleFilled } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";

import { urls } from "~/app/urls";
import { PolicyTab } from "../../../create/_components/PolicyContext";

type TabConfig = {
  id: PolicyTab;
  label: string;
  description: string;
  href: string;
};

export const PolicyEditTabs: React.FC = () => {
  const { workspaceSlug, policyId } = useParams<{
    workspaceSlug: string;
    policyId: string;
  }>();

  const pathname = usePathname();

  const policyEditUrls = urls
    .workspace(workspaceSlug)
    .policies()
    .edit(policyId);

  const tabs: TabConfig[] = [
    {
      id: "config",
      label: "Policy Configuration",
      description: "Basic policy configuration",
      href: policyEditUrls.configuration(),
    },
    {
      id: "time-windows",
      label: "Time Windows",
      description: "Schedule-based deployment rules",
      href: policyEditUrls.timeWindows(),
    },
    {
      id: "deployment-flow",
      label: "Deployment Flow",
      description: "Control deployment progression",
      href: policyEditUrls.deploymentFlow(),
    },
    {
      id: "quality-security",
      label: "Quality & Security",
      description: "Deployment safety measures",
      href: policyEditUrls.qualitySecurity(),
    },
  ];

  return (
    <div className="flex h-full">
      <div className="sticky top-0 h-full w-64 flex-shrink-0 border-r">
        <div className="flex flex-col py-2">
          {tabs.map((tab) => (
            <Link
              href={tab.href}
              key={tab.id}
              className={cn(
                "flex w-full cursor-pointer justify-start gap-3 p-3 text-muted-foreground",

                pathname === tab.href
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
                    pathname === tab.href
                      ? "text-purple-300"
                      : "text-muted-foreground",
                  )}
                >
                  {tab.description}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
