import { api } from "~/trpc/server";
import { VersionManagement } from "./VersionManagement";

export default async function ManagementPage(props: {
  params: Promise<{ environmentId: string }>;
}) {
  const { environmentId } = await props.params;
  const policy = await api.environment.policy.byEnvironmentId(environmentId);

  return <VersionManagement environmentPolicy={policy} />;
}
