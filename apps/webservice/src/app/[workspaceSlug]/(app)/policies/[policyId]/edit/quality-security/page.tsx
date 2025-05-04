import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { EditQualitySecurity } from "./EditQualitySecurity";

export default async function QualitySecurityPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();
  return <EditQualitySecurity workspaceId={workspace.id} />;
}
