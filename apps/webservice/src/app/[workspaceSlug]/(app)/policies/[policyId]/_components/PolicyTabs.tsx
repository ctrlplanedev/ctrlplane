"use client";

import type React from "react";
import { useState } from "react";

import { Tabs, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";

export const PolicyTabs: React.FC = () => {
  //   const { workspaceSlug, policyId } = useParams<{
  //     workspaceSlug: string;
  //     policyId: string;
  //   }>();

  //   const environmentUrls = urls
  //     .workspace(workspaceSlug)
  //     .policies()
  //     .edit(policyId);
  //   const baseUrl = policyUrls.baseUrl();

  //   const pathname = usePathname();
  const getInitialTab = () => {
    // if (pathname === baseUrl) return "overview";
    return "overview";
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());

  //   const router = useRouter();

  const onTabChange = (value: string) => {
    // if (value === "overview") router.push(overviewUrl);
    // if (value === "deployments") router.push(deploymentsUrl);
    // if (value === "resources") router.push(resourcesUrl);
    // if (value === "policies") router.push(policiesUrl);
    // if (value === "settings") router.push(settingsUrl);
    setActiveTab(value);
  };

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
      </TabsList>
    </Tabs>
  );
};
