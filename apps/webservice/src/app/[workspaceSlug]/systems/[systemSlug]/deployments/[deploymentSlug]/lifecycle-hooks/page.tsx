import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { LifecycleHooksPageContent } from "./LifecycleHooksPageContent";

export default async function LifecycleHooksPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string; deploymentSlug: string };
}) {
  const system = await api.system.bySlug(params);
  const runbooks = await api.runbook.bySystemId(system.id);
  const deployment = await api.deployment.bySlug(params);
  if (!deployment) notFound();
  const lifecycleHooks = await api.deployment.lifecycleHook.list.byDeploymentId(
    deployment.id,
  );

  return (
    <LifecycleHooksPageContent
      deployment={deployment}
      lifecycleHooks={lifecycleHooks}
      runbooks={runbooks}
    />
  );
}
