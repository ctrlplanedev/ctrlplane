"use client";

import type React from "react";
import { useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";

import { urls } from "~/app/urls";

export const EnvironmentTabs: React.FC = () => {
  const { workspaceSlug, systemSlug, environmentId } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
    environmentId: string;
  }>();

  const environmentUrls = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .environment(environmentId);
  const baseUrl = environmentUrls.baseUrl();
  const overviewUrl = environmentUrls.overview();
  const deploymentsUrl = environmentUrls.deployments();
  const resourcesUrl = environmentUrls.resources();
  const settingsUrl = environmentUrls.settings();

  const pathname = usePathname();
  const getInitialTab = () => {
    if (pathname === resourcesUrl) return "resources";
    if (pathname === deploymentsUrl) return "deployments";
    if (pathname === baseUrl) return "overview";
    if (pathname === settingsUrl) return "settings";
    return "overview";
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());

  const router = useRouter();

  const onTabChange = (value: string) => {
    if (value === "overview") router.push(overviewUrl);
    if (value === "deployments") router.push(deploymentsUrl);
    if (value === "resources") router.push(resourcesUrl);
    if (value === "settings") router.push(settingsUrl);
    setActiveTab(value);
  };

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="deployments">Deployments</TabsTrigger>
        <TabsTrigger value="resources">Resources</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
    </Tabs>
  );
};
