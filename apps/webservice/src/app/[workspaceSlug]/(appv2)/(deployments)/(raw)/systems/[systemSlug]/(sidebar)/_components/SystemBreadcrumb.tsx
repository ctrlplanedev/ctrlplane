"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import { useParams } from "next/navigation";
import { IconMenu2 } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ctrlplane/ui/breadcrumb";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { urls } from "~/app/urls";

type SystemBreadcrumbProps = {
  system: SCHEMA.System;
  page: string;
};

export const SystemBreadcrumb: React.FC<SystemBreadcrumbProps> = ({
  system,
  page,
}) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspaceUrls = urls.workspace(workspaceSlug);
  const systemsUrl = workspaceUrls.systems();
  const systemUrl = workspaceUrls.system(system.slug).baseUrl();
  return (
    <div className="flex items-center gap-2">
      <SidebarTrigger name={Sidebars.System}>
        <IconMenu2 className="h-4 w-4" />
      </SidebarTrigger>
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink href={systemsUrl}>Systems</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink href={systemUrl}>{system.name}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbPage>{page}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};
