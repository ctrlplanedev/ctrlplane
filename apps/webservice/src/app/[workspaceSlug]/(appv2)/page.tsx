import { redirect } from "next/navigation";

import { urls } from "~/app/urls";

export default async function WorkspacePage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const systems = urls.workspace(workspaceSlug).systems();
  redirect(systems);
}
