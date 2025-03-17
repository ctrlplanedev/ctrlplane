import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Workspace Settings | Ctrlplane",
  description: "Configure settings for your Ctrlplane workspace.",
};

export default async function WorkspaceSettingsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  return redirect(`/${workspaceSlug}/settings/workspace/overview`);
}
