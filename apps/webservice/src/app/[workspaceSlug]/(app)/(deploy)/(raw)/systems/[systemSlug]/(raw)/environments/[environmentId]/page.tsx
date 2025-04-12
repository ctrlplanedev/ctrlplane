import { redirect } from "next/navigation";

import { urls } from "~/app/urls";

export default async function EnvironmentOverviewPage(props: {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    environmentId: string;
  }>;
}) {
  const { workspaceSlug, systemSlug, environmentId } = await props.params;
  const overviewUrl = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .environment(environmentId)
    .overview();
  return redirect(overviewUrl);
}
