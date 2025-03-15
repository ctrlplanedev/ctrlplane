import { api } from "~/trpc/server";
import { DeploymentControl } from "./DeploymentControl";

export default async function ControlPage(props: {
  params: Promise<{ environmentId: string }>;
}) {
  const { environmentId } = await props.params;
  const policy = await api.environment.policy.byEnvironmentId(environmentId);

  return <DeploymentControl environmentPolicy={policy} />;
}
