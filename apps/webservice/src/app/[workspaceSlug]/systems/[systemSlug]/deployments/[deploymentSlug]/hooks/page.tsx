import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { HooksTable } from "./HooksTable";

export default async function HooksPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string; deploymentSlug: string };
}) {
  const deployment = await api.deployment.bySlug(params);
  if (!deployment) notFound();

  const hooks = await api.deployment.hook.list(deployment.id);
  const runbooks = await api.runbook.bySystemId(deployment.systemId);
  return <HooksTable hooks={hooks} runbooks={runbooks} />;
}
