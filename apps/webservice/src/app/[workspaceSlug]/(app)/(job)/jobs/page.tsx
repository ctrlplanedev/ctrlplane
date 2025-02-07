import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { JobsGettingStarted } from "./JobsGettingStarted";
import { JobTable } from "./JobTable";

export const metadata: Metadata = {
  title: "Jobs | Ctrlplane",
};

export default async function JobsPage(
  props: {
    params: Promise<{ workspaceSlug: string }>;
  }
) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) return notFound();

  const releaseJobTriggers = await api.job.config.byWorkspaceId.list({
    workspaceId: workspace.id,
    limit: 1,
  });

  if (releaseJobTriggers.length === 0) return <JobsGettingStarted />;

  return <JobTable workspaceId={workspace.id} />;
}
