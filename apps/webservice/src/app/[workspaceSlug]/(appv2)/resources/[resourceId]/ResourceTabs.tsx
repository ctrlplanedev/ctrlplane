"use client";

import React from "react";
import Link from "next/link";

import { useQueryParams } from "~/app/[workspaceSlug]/(appv2)/_components/useQueryParams";

const TabLink: React.FC<{
  href: string;
  isActive?: boolean;
  children: React.ReactNode;
}> = ({ href, isActive, children }) => {
  return (
    <Link
      href={href}
      data-state={isActive ? "active" : undefined}
      className="relative border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 text-sm text-muted-foreground shadow-none transition-none focus-visible:ring-0 data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
    >
      {children}
    </Link>
  );
};

export const ResourceTabs: React.FC = () => {
  const { getParam } = useQueryParams();
  const tab = getParam("tab");

  return (
    <div className="flex w-full justify-start">
      <TabLink
        href="?tab=deployments"
        isActive={tab == null || tab === "deployments"}
      >
        Deployments
      </TabLink>
      <TabLink href="?tab=visualize" isActive={tab === "visualize"}>
        Visualize
      </TabLink>
      <TabLink href="?tab=logs">Logs</TabLink>
      <TabLink href="?tab=logs">Audit Logs</TabLink>
      <TabLink href="?tab=logs">Variables</TabLink>
    </div>
  );
};
