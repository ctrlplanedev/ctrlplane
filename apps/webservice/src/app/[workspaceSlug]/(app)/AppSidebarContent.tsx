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
    popoverId: "systems",
    items: [
      {
        title: "List",
        url: `${prefix}/systems`,
        isActive: true,
      },
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
        url: `${prefix}/resources`,
      },
      {
        title: "Providers",
        url: `${prefix}/resource-providers`,
      },
      {
        title: "Groups",
        url: `${prefix}/resource-metadata-groups`,
      },
      {
        title: "Views",
        url: `${prefix}/resource-views`,
      },
    ],
  },
  {
    title: "Jobs",
    icon: IconRocket,
    popoverId: "jobs",
    isOpen: true,
    items: [
      {
        title: "Agents",
        url: `${prefix}/job-agents`,
      },
      {
        title: "Runs",
        url: `${prefix}/jobs`,
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
  workspaceSlug: string;
  systems: System[];
}> = ({ workspaceSlug, systems }) => {
  const items = useMemo(
    () =>
      systems.map((s) => ({
        title: s.name,
        isActive: true,
        popoverId: `system:${s.id}`,
        items: [
          {
            title: "Environments",
            icon: IconPlant,
            url: `/${workspaceSlug}/systems/${s.slug}/environments`,
          },
          {
            title: "Deployments",
            icon: IconShip,
            url: `/${workspaceSlug}/systems/${s.slug}/deployments`,
          },
          {
            title: "Runbooks",
            icon: IconRun,
            url: `/${workspaceSlug}/systems/${s.slug}/runbooks`,
          },
          {
            title: "Variable Sets",
            icon: IconVariable,
            url: `/${workspaceSlug}/systems/${s.slug}/variable-sets`,
          },
        ],
      })),
    [workspaceSlug, systems],
  );
  return <SidebarNavMain title="Systems" items={items} />;
};
