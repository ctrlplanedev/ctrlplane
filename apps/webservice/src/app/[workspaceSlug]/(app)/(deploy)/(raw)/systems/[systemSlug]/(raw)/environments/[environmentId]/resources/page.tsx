import { ResourcesPageContent } from "./ResourcesPageContent";

export default async function ResourcesPage(props: {
  params: Promise<{ environmentId: string }>;
}) {
  const { environmentId } = await props.params;
  return <ResourcesPageContent environmentId={environmentId} />;
}
