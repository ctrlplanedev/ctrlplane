import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { PoliciesPageContent } from "./PoliciesPageContent";

export default async function PoliciesPage(props: {
  params: Promise<{ environmentId: string }>;
}) {
  const { environmentId } = await props.params;
  const environment = await api.environment.byId(environmentId);
  if (environment == null) return notFound();
  return <PoliciesPageContent environment={environment} />;
}
