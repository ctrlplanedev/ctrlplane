import { PoliciesPageContent } from "./PoliciesPageContent";

export default async function PoliciesPage(props: {
  params: Promise<{ environmentId: string }>;
}) {
  const { environmentId } = await props.params;
  return <PoliciesPageContent environmentId={environmentId} />;
}
