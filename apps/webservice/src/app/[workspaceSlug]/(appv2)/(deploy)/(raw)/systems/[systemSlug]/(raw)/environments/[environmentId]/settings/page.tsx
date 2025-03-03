import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { Overview } from "./Overview";

export default async function SettingsPage(props: {
  params: Promise<{ environmentId: string }>;
}) {
  const { environmentId } = await props.params;

  const environment = await api.environment.byId(environmentId);
  if (environment == null) notFound();

  return (
    <div className="container">
      <Overview environment={environment} />
    </div>
  );
}
