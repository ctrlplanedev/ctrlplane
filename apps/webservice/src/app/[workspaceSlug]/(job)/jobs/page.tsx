import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { JobsGettingStarted } from "./JobsGettingStarted";
import { JobTable } from "./JobTable";

export default async function JobsPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) return notFound();

  const releaseJobTriggers = await api.job.config.byWorkspaceId.list({
    workspaceId: workspace.id,
  });

  if (releaseJobTriggers.total === 0) return <JobsGettingStarted />;

  return <JobTable workspaceId={workspace.id} />;
}
