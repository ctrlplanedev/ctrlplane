"use client";

import React from "react";
import { useParams, usePathname } from "next/navigation";

import { TabLink, Tabs, TabsList } from "../../_components/navigation/Tabs";

const getActiveTab = (url: string) => {
  if (url.endsWith("/visualize")) return "visualize";
  if (url.endsWith("/variables")) return "variables";
  if (url.endsWith("/properties")) return "properties";
  return "deployments";
};

export const DeploymentTabs: React.FC = () => {
  const { workspaceSlug, resourceId } = useParams<{
    workspaceSlug: string;
    resourceId: string;
  }>();

  const pathname = usePathname();
  const activeTab = getActiveTab(pathname);
  const baseUrl = `/${workspaceSlug}/resources/${resourceId}`;

  return (
    <Tabs>
      <TabsList>
        <TabLink href={baseUrl} isActive={activeTab === "deployments"}>
          Deployments
        </TabLink>
        <TabLink
          href={`${baseUrl}/visualize`}
          isActive={activeTab === "visualize"}
        >
          Visualize
        </TabLink>
        <TabLink
          href={`${baseUrl}/variables`}
          isActive={activeTab === "variables"}
        >
          Variables
        </TabLink>
        <TabLink
          href={`${baseUrl}/properties`}
          isActive={activeTab === "properties"}
        >
          Properties
        </TabLink>
      </TabsList>
    </Tabs>
  );
};
