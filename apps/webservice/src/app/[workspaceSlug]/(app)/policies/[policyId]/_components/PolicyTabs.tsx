"use client";

import type React from "react";
import { useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { IconCircleCheck, IconClock, IconTag } from "@tabler/icons-react";

import { Tabs, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";

import { urls } from "~/app/urls";

export const PolicyTabs: React.FC = () => {
  const { workspaceSlug, policyId } = useParams<{
    workspaceSlug: string;
    policyId: string;
  }>();

  const policyUrls = urls.workspace(workspaceSlug).policies();

  const editUrls = policyUrls.edit(policyId);
  const baseUrl = policyUrls.byId(policyId);

  const configurationUrl = editUrls.configuration();
  const timeWindowsUrl = editUrls.timeWindows();
  const deploymentFlowUrl = editUrls.deploymentFlow();
  const qualitySecurityUrl = editUrls.qualitySecurity();

  const pathname = usePathname();

  const getInitialTab = () => {
    if (pathname === baseUrl) return "overview";
    if (pathname === configurationUrl) return "configuration";
    if (pathname === timeWindowsUrl) return "time-windows";
    if (pathname === deploymentFlowUrl) return "deployment-flow";
    if (pathname === qualitySecurityUrl) return "quality-security";
    return "overview";
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());

  const router = useRouter();

  const onTabChange = (value: string) => {
    if (value === "overview") router.push(baseUrl);
    if (value === "configuration") router.push(configurationUrl);
    if (value === "time-windows") router.push(timeWindowsUrl);
    if (value === "deployment-flow") router.push(deploymentFlowUrl);
    if (value === "quality-security") router.push(qualitySecurityUrl);
    setActiveTab(value);
  };

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="configuration">Edit</TabsTrigger>
        <TabsTrigger value="time-windows" className="flex items-center gap-1">
          <IconClock className="h-4 w-4" />
          Time Windows
        </TabsTrigger>
        <TabsTrigger
          value="deployment-flow"
          className="flex items-center gap-1"
        >
          <IconTag className="h-4 w-4" />
          Version Conditions
        </TabsTrigger>
        <TabsTrigger
          value="quality-security"
          className="flex items-center gap-1"
        >
          <IconCircleCheck className="h-4 w-4" />
          Approval Gates
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};
