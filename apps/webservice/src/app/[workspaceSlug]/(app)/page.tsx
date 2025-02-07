import { redirect } from "next/navigation";

export default async function WorkspacePage(
  props: {
    params: Promise<{ workspaceSlug: string }>;
  }
) {
  const params = await props.params;
  redirect(`/${params.workspaceSlug}/systems`);
}
