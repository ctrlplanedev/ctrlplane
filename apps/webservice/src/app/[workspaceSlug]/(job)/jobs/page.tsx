"use client";

import { api } from "~/trpc/react";

export default function JobsPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const workspace = api.workspace.bySlug.useQuery(params.workspaceSlug);
  const jobConfigs = api.job.config.byWorkspaceId.useQuery(
    workspace.data?.id ?? "",
    { enabled: workspace.isSuccess },
  );
  return (
    <div>
      {jobConfigs.data?.map((d) => (
        <div key={d.id}>
          {d.environment?.name} / {d.target?.name} / {d.release.version}
        </div>
      ))}
    </div>
  );
}
