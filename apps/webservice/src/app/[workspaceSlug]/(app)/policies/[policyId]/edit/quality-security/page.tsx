import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { EditQualitySecurity } from "./EditQualitySecurity";

export default async function QualitySecurityPage(props: {
  params: Promise<{ workspaceSlug: string; policyId: string }>;
}) {
  const { workspaceSlug, policyId } = await props.params;
  const [workspace, policy] = await Promise.all([
    api.workspace.bySlug(workspaceSlug),
    api.policy.byId({ policyId }),
  ]);
  if (workspace == null || policy == null) return notFound();
  return <EditQualitySecurity policy={policy} workspaceId={workspace.id} />;
}
