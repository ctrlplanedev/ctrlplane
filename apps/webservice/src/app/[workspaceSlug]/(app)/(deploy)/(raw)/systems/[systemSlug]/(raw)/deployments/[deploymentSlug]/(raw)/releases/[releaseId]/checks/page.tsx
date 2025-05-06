import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconMenu2 } from "@tabler/icons-react";
import _ from "lodash";

import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { ReactFlowProvider } from "~/app/[workspaceSlug]/(app)/_components/reactflow/ReactFlowProvider";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/server";
import { FlowDiagram } from "../checks/_components/flow-diagram/FlowDiagram";

type PageProps = {
  params: Promise<{
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

  const deploymentVersion = await api.deployment.version.byId(params.releaseId);
  if (deploymentVersion == null) return notFound();

  return {
    title: `${deploymentVersion.tag} | ${deployment.name} | ${deployment.system.name} | ${deployment.system.workspace.name}`,
  };
}

export default async function ChecksPage(props: PageProps) {
  const params = await props.params;
  const deploymentVersionPromise = api.deployment.version.byId(
    params.releaseId,
  );
  const deploymentPromise = api.deployment.bySlug(params);
  const [deploymentVersion, deployment] = await Promise.all([
    deploymentVersionPromise,
    deploymentPromise,
  ]);
  if (deploymentVersion == null || deployment == null) return notFound();

  const { system } = deployment;
  const releaseTargets = await api.releaseTarget.list({
    deploymentId: deployment.id,
  });

  const environments = _.uniqBy(
    releaseTargets.map((r) => r.environment),
    (env) => env.id,
  );

  return (
    <div className="relative h-full">
      <SidebarTrigger
        name={Sidebars.Release}
        className="absolute left-2 top-2 z-10"
      >
        <IconMenu2 className="h-4 w-4" />
      </SidebarTrigger>
      <ReactFlowProvider>
        <FlowDiagram
          workspace={system.workspace}
          deploymentVersion={deploymentVersion}
          envs={environments}
        />
      </ReactFlowProvider>
    </div>
  );
}
