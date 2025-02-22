import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";

import { Separator } from "@ctrlplane/ui/separator";

import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { ReactFlowProvider } from "~/app/[workspaceSlug]/(appv2)/_components/reactflow/ReactFlowProvider";
import { api } from "~/trpc/server";
import { FlowDiagram } from "./flow-diagram/FlowDiagram";

type PageProps = {
  params: Promise<{
    release: { id: string; version: string };
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
    releaseId: string;
  }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();

  const release = await api.release.byId(params.releaseId);
  if (release == null) return notFound();

  return {
    title: `${release.version} | ${deployment.name} | ${deployment.system.name} | ${deployment.system.workspace.name}`,
  };
}

export default async function ChecksPage(props: PageProps) {
  const params = await props.params;
  const releasePromise = api.release.byId(params.releaseId);
  const deploymentPromise = api.deployment.bySlug(params);
  const [release, deployment] = await Promise.all([
    releasePromise,
    deploymentPromise,
  ]);
  if (release == null || deployment == null) return notFound();

  const { system } = deployment;
  const environmentsPromise = api.environment.bySystemId(system.id);
  const policiesPromise = api.environment.policy.bySystemId(system.id);
  const policyDeploymentsPromise = api.environment.policy.deployment.bySystemId(
    system.id,
  );
  const [environments, policies, policyDeployments] = await Promise.all([
    environmentsPromise,
    policiesPromise,
    policyDeploymentsPromise,
  ]);
  return (
    <div className="h-full">
      <PageHeader className="space-x-2">
        <Link
          href={`/${params.workspaceSlug}/systems/${params.systemSlug}/deployments/${params.deploymentSlug}/releases`}
        >
          <IconArrowLeft className="size-5" />
        </Link>
        <Separator orientation="vertical" className="h-4" />
        <div className="shrink-0 text-lg text-muted-foreground">
          Release{" "}
          <span className="font-semibold text-white">{release.version}</span>
        </div>
      </PageHeader>

      <div className="h-full">
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
    </div>
  );
}
