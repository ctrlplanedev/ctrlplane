import { notFound, redirect } from "next/navigation";

import { urls } from "~/app/urls";
import { api } from "~/trpc/server";

export default async function CreatePolicyPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; policyId: string }>;
}) {
  const { workspaceSlug, policyId } = await params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();

  const policy = await api.policy.byId({ policyId });
  if (policy == null) return notFound();

  return redirect(
    urls.workspace(workspaceSlug).policies().edit(policyId).configuration(),
  );
}
