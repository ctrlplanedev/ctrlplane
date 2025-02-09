import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ScrollArea } from "@ctrlplane/ui/scroll-area";

import { ReactFlowProvider } from "~/app/[workspaceSlug]/(app)/_components/reactflow/ReactFlowProvider";
import { api } from "~/trpc/server";
import { FlowDiagram } from "./FlowDiagram";
import { ResourceReleaseTable } from "./ResourceReleaseTable";

type PageProps = {
  params: Promise<{
    release: { id: string; version: string };
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
    versionId: string;
  }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();

  const release = await api.release.byId(params.versionId);
  if (release == null) return notFound();

  return {
    title: `${release.version} | ${deployment.name} | ${deployment.system.name} | ${deployment.system.workspace.name}`,
  };
}

export default async function ReleasePage(props: PageProps) {
  const params = await props.params;
  const release = await api.release.byId(params.versionId);
  const deployment = await api.deployment.bySlug(params);
  if (release == null || deployment == null) notFound();

  const { system } = deployment;
  const environments = await api.environment.bySystemId(system.id);
  const policies = await api.environment.policy.bySystemId(system.id);
  const policyDeployments = await api.environment.policy.deployment.bySystemId(
    system.id,
  );

  return (
    <div className="flex h-[calc(100vh-103px)] flex-col">
      <div className="shrink-0 border-b p-4 text-lg text-muted-foreground">
        Release{" "}
        <span className="font-semibold text-white">{release.version}</span>
      </div>

      <ScrollArea>
        <div className="h-[350px] shrink-0 border-b">
          <ReactFlowProvider>
            <FlowDiagram
              workspace={system.workspace}
              release={release}
              envs={environments}
              systemId={system.id}
              policies={policies}
              policyDeployments={policyDeployments}
            />
          </ReactFlowProvider>
        </div>

        <ResourceReleaseTable
          release={release}
          deployment={deployment}
          environments={environments}
        />
      </ScrollArea>
    </div>
  );
}
