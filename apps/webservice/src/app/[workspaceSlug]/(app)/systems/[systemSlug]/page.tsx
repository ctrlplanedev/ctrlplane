import { redirect } from "next/navigation";

export default async function SystemPage(
  props: {
    params: Promise<{ workspaceSlug: string; systemSlug: string }>;
  }
) {
  const params = await props.params;
  redirect(`/${params.workspaceSlug}/systems/${params.systemSlug}/deployments`);
}
