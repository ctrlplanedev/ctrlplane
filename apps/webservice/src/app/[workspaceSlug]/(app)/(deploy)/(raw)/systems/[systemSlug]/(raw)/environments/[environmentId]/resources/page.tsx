import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";

import { ResourcesPageContent } from "./ResourcesPageContent";

export default async function ResourcesPage(props: {
  params: Promise<{ environmentId: string }>;
}) {
  const { environmentId } = await props.params;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resources</CardTitle>
        <CardDescription>Resources managed in this environment</CardDescription>
      </CardHeader>
      <CardContent>
        <ResourcesPageContent environmentId={environmentId} />
      </CardContent>
    </Card>
  );
}
