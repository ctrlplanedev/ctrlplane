import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { GoogleIntegration } from "./GoogleIntegration";

export const metadata = { title: "Google Integrations - Settings" };

export default async function GoogleIntegrationPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();
  return <GoogleIntegration workspace={workspace} />;
}
