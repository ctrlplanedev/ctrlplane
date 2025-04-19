import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { PolicyReleaseTargets } from "./_components/PolicyReleaseTargets";

export default async function PolicyPage(props: {
  params: Promise<{ workspaceSlug: string; policyId: string }>;
}) {
  const { policyId } = await props.params;
  const policy = await api.policy.byId({ policyId });
  if (policy == null) notFound();

  return (
    <>
      <PolicyReleaseTargets policy={policy} />
    </>
  );
}
