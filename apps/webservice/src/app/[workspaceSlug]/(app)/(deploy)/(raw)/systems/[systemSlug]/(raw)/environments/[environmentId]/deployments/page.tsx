import { EnvironmentDeploymentsPageContent } from "./EnvironmentDeploymentsPageContent";

export default async function DeploymentsPage(props: {
  params: Promise<{ environmentId: string }>;
}) {
  const { environmentId } = await props.params;
  return <EnvironmentDeploymentsPageContent environmentId={environmentId} />;
}
