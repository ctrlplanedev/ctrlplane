"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";
import { Input } from "@ctrlplane/ui/input";

import { api } from "~/trpc/react";
import { CreateDeploymentDialog } from "../_components/deployments/CreateDeployment";
import { CreateSystemDialog } from "../../(app)/_components/CreateSystem";
import { SystemDeploymentSkeleton } from "./_components/system-deployment-table/SystemDeploymentSkeleton";
import { SystemDeploymentTable } from "./_components/system-deployment-table/SystemDeploymentTable";

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
    <div className="m-8 space-y-8">
      <div className="flex w-full items-center justify-between">
        <h2 className="text-2xl font-bold">Systems</h2>
        <div className="flex items-center gap-2">
          <CreateSystemDialog workspace={workspace}>
            <Button variant="outline">New System</Button>
          </CreateSystemDialog>
          <CreateDeploymentDialog>
            <Button variant="outline">New Deployment</Button>
          </CreateDeploymentDialog>
        </div>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search systems and deployments..."
        className="w-80"
      />
      {isLoading &&
        Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-md border">
            <SystemDeploymentSkeleton />
          </div>
        ))}
      {!isLoading &&
        systems.map((s) => (
          <SystemDeploymentTable key={s.id} workspace={workspace} system={s} />
        ))}
    </div>
  );
};
