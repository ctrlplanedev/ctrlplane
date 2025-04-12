import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { EditConfiguration } from "./EditConfiguration";

export default async function ConfigurationPage(props: {
  params: Promise<{ policyId: string }>;
}) {
  const { policyId } = await props.params;

  const policy = await api.policy.byId({ policyId });
  if (policy == null) return notFound();

  return <EditConfiguration policy={policy} />;
}
