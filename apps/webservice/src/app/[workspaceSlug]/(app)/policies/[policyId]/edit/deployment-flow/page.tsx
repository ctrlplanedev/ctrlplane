import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { EditDeploymentFlow } from "./EditDeploymentFlow";

export default async function DeploymentFlowPage(props: {
  params: Promise<{ policyId: string }>;
}) {
  const { policyId } = await props.params;
  const policy = await api.policy.byId({ policyId });
  if (policy == null) return notFound();
  return <EditDeploymentFlow policy={policy} />;
}
