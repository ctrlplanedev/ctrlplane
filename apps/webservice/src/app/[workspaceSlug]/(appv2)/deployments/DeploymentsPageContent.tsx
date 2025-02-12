"use client";

import React, { useState } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@ctrlplane/ui/breadcrumb";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";

import { PageHeader } from "../_components/PageHeader";
import { DeploymentsCard } from "../systems/[systemSlug]/(sidebar)/deployments/Card";

type DeploymentsPageContentProps = { workspaceId: string };

export const DeploymentsPageContent: React.FC<DeploymentsPageContentProps> = ({
  workspaceId,
}) => {
  const [timePeriod, setTimePeriod] = useState("14d");

  return (
    <div>
      <PageHeader>
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="#">Deployments</BreadcrumbLink>
            </BreadcrumbItem>
            {/* <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>Data Fetching</BreadcrumbPage>
            </BreadcrumbItem> */}
          </BreadcrumbList>
        </Breadcrumb>
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Tabs value={timePeriod} onValueChange={setTimePeriod}>
          <TabsList>
            <TabsTrigger value="mtd">MTD</TabsTrigger>
            <TabsTrigger value="7d">7D</TabsTrigger>
            <TabsTrigger value="14d">14D</TabsTrigger>
            <TabsTrigger value="30d">30D</TabsTrigger>
            <TabsTrigger value="3m">3M</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      <DeploymentsCard workspaceId={workspaceId} timePeriod={timePeriod} />
    </div>
  );
};
