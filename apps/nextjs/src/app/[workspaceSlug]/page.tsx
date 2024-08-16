import { redirect } from "next/navigation";

export default function WorkspacePage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  redirect(`/${params.workspaceSlug}/systems`);
}
