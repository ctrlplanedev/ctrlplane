import { redirect } from "next/navigation";

export default async function WorkspaceSettingsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  return redirect(`/${workspaceSlug}/settings/workspace/overview`);
}
