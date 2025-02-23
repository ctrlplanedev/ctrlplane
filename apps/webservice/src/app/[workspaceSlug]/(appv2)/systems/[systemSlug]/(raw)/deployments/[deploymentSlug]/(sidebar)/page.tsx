import { redirect } from "next/navigation";

export default async function DeploymentPage(props: {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>;
}) {
  const { workspaceSlug, systemSlug, deploymentSlug } = await props.params;
  return redirect(
    `/${workspaceSlug}/systems/${systemSlug}/deployments/${deploymentSlug}/releases`,
  );
}
