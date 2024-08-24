"use client";

import { api } from "~/trpc/react";
import { ReactFlowProvider } from "../_components/reactflow/ReactFlowProvider";
import { DependencyDiagram } from "./DependencyDiagram";

export default function Dependencies({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const workspace = api.workspace.bySlug.useQuery(params.workspaceSlug);
  const deployments = api.deployment.byWorkspaceId.useQuery(
    workspace.data?.id ?? "",
    { enabled: workspace.isSuccess },
  );

  return (
    <div className="h-full">
      <ReactFlowProvider>
        {deployments.data && (
          <DependencyDiagram deployments={deployments.data} />
        )}
      </ReactFlowProvider>
    </div>
  );
}
