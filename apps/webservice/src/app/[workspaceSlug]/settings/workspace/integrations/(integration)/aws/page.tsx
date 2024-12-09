import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { AwsIntegration } from "./AwsIntegration";

export const metadata = { title: "AWS Integrations - Settings" };

export default async function AWSIntegrationPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();
  return <AwsIntegration workspace={workspace} />;
}
