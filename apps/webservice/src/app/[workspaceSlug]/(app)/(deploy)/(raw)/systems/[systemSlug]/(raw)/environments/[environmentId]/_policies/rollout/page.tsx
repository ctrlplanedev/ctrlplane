import { api } from "~/trpc/server";
import { RolloutAndTiming } from "./RolloutAndTiming";

export default async function RolloutPage(props: {
  params: Promise<{ environmentId: string }>;
}) {
  const { environmentId } = await props.params;
  const policy = await api.environment.policy.byEnvironmentId(environmentId);

  return <RolloutAndTiming environmentPolicy={policy} />;
}
