import { EditTimeWindow } from "./EditTimeWindow";

export default async function TimeWindowsPage(props: {
  params: Promise<{ policyId: string }>;
}) {
  const { policyId } = await props.params;
  return <EditTimeWindow policyId={policyId} />;
}
