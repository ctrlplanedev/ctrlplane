import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { AwsIntegration } from "./AwsIntegration";

export const metadata = { title: "AWS Integrations - Settings" };

export default async function AWSIntegrationPage(
  props: {
    params: Promise<{ workspaceSlug: string }>;
  }
) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();
  return <AwsIntegration workspace={workspace} />;
}
