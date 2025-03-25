import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { EditFilterForm } from "./EditFilterForm";

export default async function ResourcesPage(props: {
  params: Promise<{ workspaceSlug: string; environmentId: string }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();

  const environment = await api.environment.byId(params.environmentId);
  if (environment == null) notFound();

  return (
    <div className="container m-8 mx-auto">
      <EditFilterForm environment={environment} workspaceId={workspace.id} />
    </div>
  );
}
