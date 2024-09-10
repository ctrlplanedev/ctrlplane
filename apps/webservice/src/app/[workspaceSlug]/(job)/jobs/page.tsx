import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { JobsGettingStarted } from "./JobsGettingStarted";

export default async function JobsPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) return notFound();

  const jobConfigs = await api.job.config.byWorkspaceId(workspace.id);

  if (jobConfigs.length === 0) return <JobsGettingStarted />;
  return (
    <div>
      {jobConfigs.map((d) => (
        <div key={d.id}>
          {d.environment?.name} / {d.target?.name} / {d.release.version}
        </div>
      ))}
    </div>
  );
}
