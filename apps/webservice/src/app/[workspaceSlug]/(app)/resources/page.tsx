import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Resources | Ctrlplane",
  description: "Manage and view all your cloud resources in Ctrlplane.",
};

export default async function ResourcesPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  redirect(`/${params.workspaceSlug}/resources/list`);
}
