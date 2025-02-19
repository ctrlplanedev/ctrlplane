import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { AwsIntegration } from "./AwsIntegration";

export const metadata = { title: "AWS Integrations - Settings" };

export default async function AWSIntegrationPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();
  return (
    <div className="container mx-auto max-w-3xl space-y-8 overflow-auto pt-8">
      <AwsIntegration workspace={workspace} />
    </div>
  );
}
