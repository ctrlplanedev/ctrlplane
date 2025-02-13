import { api } from "~/trpc/server";
import { ApprovalAndGovernance } from "./ApprovalAndGovernance";

export default async function ApprovalPage(props: {
  params: Promise<{ environmentId: string }>;
}) {
  const { environmentId } = await props.params;
  const policy = await api.environment.policy.byEnvironmentId(environmentId);

  return <ApprovalAndGovernance environmentPolicy={policy} />;
}
