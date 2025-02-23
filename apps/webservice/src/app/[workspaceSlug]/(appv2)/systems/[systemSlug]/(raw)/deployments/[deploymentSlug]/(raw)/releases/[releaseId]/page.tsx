import { redirect } from "next/navigation";

export default async function ReleasePage(props: {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
    releaseId: string;
  }>;
}) {
  const params = await props.params;
  return redirect(
    `/${params.workspaceSlug}/systems/${params.systemSlug}/deployments/${params.deploymentSlug}/releases/${params.releaseId}/jobs`,
  );
}
