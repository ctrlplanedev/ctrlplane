"use client";

import type { System, Workspace } from "@ctrlplane/db/schema";
import Link from "next/link";
import { useInView } from "react-intersection-observer";

import { api } from "~/trpc/react";
import DeploymentTable from "./[systemSlug]/(sidebar)/deployments/TableDeployments";

export const SystemDeploymentTable: React.FC<{
  workspace: Workspace;
  system: System;
}> = ({ workspace, system }) => {
  const { ref, inView } = useInView();
  const environments = api.environment.bySystemId.useQuery(system.id, {
    enabled: inView,
  });
  const deployments = api.deployment.bySystemId.useQuery(system.id, {
    enabled: inView,
  });

  return (
    <div key={system.id} className="space-y-4">
      <Link
        className="flex items-center gap-2 text-lg font-bold hover:text-blue-300"
        href={`/${workspace.slug}/systems/${system.slug}`}
      >
        {system.name}
      </Link>

      <div ref={ref} className="overflow-hidden rounded-md border">
        <DeploymentTable
          workspace={workspace}
          systemSlug={system.slug}
          environments={environments.data ?? []}
          deployments={deployments.data ?? []}
        />
      </div>
    </div>
  );
};
