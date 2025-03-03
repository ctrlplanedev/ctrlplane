import { redirect } from "next/navigation";

export default async function EnvironmentPage(props: {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    environmentId: string;
  }>;
}) {
  const { workspaceSlug, systemSlug, environmentId } = await props.params;
  return redirect(
    `/${workspaceSlug}/systems/${systemSlug}/environments/${environmentId}/deployments`,
  );
}
