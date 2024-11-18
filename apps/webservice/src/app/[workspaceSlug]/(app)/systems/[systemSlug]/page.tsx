import { redirect } from "next/navigation";

export default function SystemPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string };
}) {
  redirect(`/${params.workspaceSlug}/systems/${params.systemSlug}/deployments`);
}
