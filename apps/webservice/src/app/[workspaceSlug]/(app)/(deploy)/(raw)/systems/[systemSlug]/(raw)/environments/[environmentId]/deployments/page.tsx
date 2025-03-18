import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";

import { EnvironmentDeploymentsPageContent } from "./EnvironmentDeploymentsPageContent";

export default async function DeploymentsPage(props: {
  params: Promise<{ environmentId: string }>;
}) {
  const { environmentId } = await props.params;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployments</CardTitle>
        <CardDescription>View detailed deployment information</CardDescription>
      </CardHeader>
      <CardContent>
        <EnvironmentDeploymentsPageContent environmentId={environmentId} />
      </CardContent>
    </Card>
  );
}
