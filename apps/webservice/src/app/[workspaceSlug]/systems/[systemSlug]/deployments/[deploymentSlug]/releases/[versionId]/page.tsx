import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconFilter } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { ScrollArea } from "@ctrlplane/ui/scroll-area";

import { ReactFlowProvider } from "~/app/[workspaceSlug]/_components/reactflow/ReactFlowProvider";
import { api } from "~/trpc/server";
import { FlowDiagram } from "./FlowDiagram";
import { TargetReleaseTable } from "./TargetReleaseTable";

export const metadata: Metadata = {
  title: "Release",
};

export default async function ReleasePage({
  params,
}: {
  params: {
    release: { id: string; version: string };
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
    versionId: string;
  };
}) {
  const release = await api.release.byId(params.versionId);
  const deployment = await api.deployment.bySlug(params);
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) return notFound();

  if (release == null || deployment == null) notFound();

  const system = await api.system.bySlug(params);
  const environments = await api.environment.bySystemId(system.id);
  const policies = await api.environment.policy.bySystemId(system.id);
  const policyDeployments = await api.environment.policy.deployment.bySystemId(
    system.id,
  );

  return (
    <div className="flex h-[calc(100vh-53px)] flex-col">
      <div className="shrink-0 border-b p-4 text-lg text-muted-foreground">
        Release{" "}
        <span className="font-semibold text-white">{release.version}</span>
      </div>

      <ScrollArea>
        <div className="h-[250px] shrink-0 border-b">
          <ReactFlowProvider>
            <FlowDiagram
              release={release}
              envs={environments}
              systemId={system.id}
              policies={policies}
              policyDeployments={policyDeployments}
            />
          </ReactFlowProvider>
        </div>

        <div className="shrink-0 border-b p-1">
          <Button variant="ghost" size="sm" className="flex gap-1">
            <IconFilter className="h-4 w-4" /> Filter
          </Button>
        </div>

        <TargetReleaseTable
          release={release}
          deploymentName={deployment.name}
          environments={environments}
        />
      </ScrollArea>
    </div>
  );
}
