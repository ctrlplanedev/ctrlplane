"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconMenu2 } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Button } from "@ctrlplane/ui/button";
import { Input } from "@ctrlplane/ui/input";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { CreateDeploymentDialog } from "~/app/[workspaceSlug]/(appv2)/_components/deployments/CreateDeployment";
import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { api } from "~/trpc/react";
import { Sidebars } from "../../../../sidebars";
import { SystemDeploymentSkeleton } from "./_components/system-deployment-table/SystemDeploymentSkeleton";
import { SystemDeploymentTable } from "./_components/system-deployment-table/SystemDeploymentTable";
import { CreateSystemDialog } from "./CreateSystem";

const useSystemFilter = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter");

  const setFilter = (filter: string) => {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);

    if (filter === "") {
      params.delete("filter");
      router.replace(`${url.pathname}?${params.toString()}`);
      return;
    }

    params.set("filter", filter);
    router.replace(`${url.pathname}?${params.toString()}`);
  };

  return { filter, setFilter };
};

export const SystemsPageContent: React.FC<{
  workspace: SCHEMA.Workspace;
}> = ({ workspace }) => {
  const { filter, setFilter } = useSystemFilter();
  const [search, setSearch] = useState(filter ?? "");

  useEffect(() => {
    if (search !== (filter ?? "")) setFilter(search);
  }, [search, filter, setFilter]);

  const workspaceId = workspace.id;
  const query = filter ?? undefined;
  const { data, isLoading } = api.system.list.useQuery(
    { workspaceId, query },
    { placeholderData: (prev) => prev },
  );

  const systems = data?.items ?? [];

  return (
    <div className="flex flex-col">
      <PageHeader className="z-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SidebarTrigger name={Sidebars.Deployments}>
            <IconMenu2 className="h-4 w-4" />
          </SidebarTrigger>
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbPage>Systems</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-2">
          <CreateSystemDialog workspace={workspace}>
            <Button variant="outline" size="sm">
              New System
            </Button>
          </CreateSystemDialog>
          <CreateDeploymentDialog>
            <Button variant="outline" size="sm">
              New Deployment
            </Button>
          </CreateDeploymentDialog>
        </div>
      </PageHeader>

      <div className="space-y-8 p-8">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search systems and deployments..."
          className="w-80"
        />
        {isLoading &&
          Array.from({ length: 2 }).map((_, i) => (
            <SystemDeploymentSkeleton key={i} />
          ))}
        {!isLoading &&
          systems.map((s) => (
            <SystemDeploymentTable
              key={s.id}
              workspace={workspace}
              system={s}
            />
          ))}
      </div>
    </div>
  );
};
