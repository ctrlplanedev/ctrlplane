"use client";

import type { System } from "@ctrlplane/db/schema";
import { useMemo } from "react";
import {
  IconCategory,
  IconObjectScan,
  IconPlant,
  IconRocket,
  IconRun,
  IconShip,
  IconVariable,
} from "@tabler/icons-react";

import { SidebarNavMain } from "../SidebarNavMain";

const navMain = (prefix: string) => [
  {
    title: "Systems",
    icon: IconCategory,
    isOpen: true,
    items: [
      {
        title: "Dependencies",
        url: `${prefix}/dependencies`,
        isActive: true,
      },
    ],
  },
  {
    title: "Resources",
    popoverId: "resources",
    icon: IconObjectScan,
    isOpen: true,
    items: [
      {
        title: "List",
        url: `${prefix}/targets`,
      },
      {
        title: "Providers",
        url: `${prefix}/target-providers`,
      },
      {
        title: "Groups",
        url: `${prefix}/target-metadata-groups`,
      },
      {
        title: "Views",
        url: `${prefix}/target-views`,
      },
    ],
  },
  {
    title: "Jobs",
    icon: IconRocket,
    isOpen: true,
    items: [
      {
        title: "Agents",
        url: "#",
      },
      {
        title: "Runs",
        url: "#",
      },
    ],
  },
];

export const AppSidebarWorkspace: React.FC<{ workspaceSlug: string }> = ({
  workspaceSlug,
}) => {
  const items = useMemo(() => navMain(`/${workspaceSlug}`), [workspaceSlug]);
  return <SidebarNavMain title="Workspace" items={items} />;
};

export const AppSidebarSystem: React.FC<{
  systems: System[];
}> = ({ systems }) => {
  const items = useMemo(
    () =>
      systems.map((s) => ({
        title: s.name,
        isActive: true,
        items: [
          {
            title: "Environments",
            icon: IconPlant,
            url: "#",
          },
          {
            title: "Deployements",
            icon: IconShip,
            url: "#",
          },
          {
            title: "Runbooks",
            icon: IconRun,
            url: "#",
          },
          {
            title: "Variable Sets",
            icon: IconVariable,
            url: "#",
          },
        ],
      })),
    [systems],
  );
  return <SidebarNavMain title="Systems" items={items} />;
};
