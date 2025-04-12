import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { SettingsPageContent } from "./SettingsPageContent";

export default async function EnvironmentSettingsPage({
  params,
}: {
  params: Promise<{ environmentId: string }>;
}) {
  const { environmentId } = await params;

  const environment = await api.environment.byId(environmentId);
  if (environment == null) return notFound();

  return <SettingsPageContent environment={environment} />;
}
