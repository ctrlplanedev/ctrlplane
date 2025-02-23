import { redirect } from "next/navigation";

export default async function ResourcesPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  redirect(`/${params.workspaceSlug}/resources/list`);
}
