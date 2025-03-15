import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { GoogleIntegration } from "./GoogleIntegration";

export const metadata = { title: "Google Integrations - Settings" };

export default async function GoogleIntegrationPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();
  return (
    <div className="container mx-auto max-w-3xl space-y-8 overflow-auto pt-8">
      <GoogleIntegration workspace={workspace} />
    </div>
  );
}
