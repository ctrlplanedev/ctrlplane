import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { SystemsPageContent } from "./SystemsPageContent";

export const generateMetadata = async (props: {
  params: { workspaceSlug: string };
}): Promise<Metadata> => {
  try {
    const workspace = await api.workspace.bySlug(props.params.workspaceSlug);
    return {
      title: `Systems | ${workspace?.name ?? props.params.workspaceSlug} | Ctrlplane`,
      description: `Manage and deploy systems for the ${workspace?.name ?? props.params.workspaceSlug} workspace.`,
    };
  } catch {
    return {
      title: "Systems | Ctrlplane",
      description: "Manage and deploy your systems with Ctrlplane.",
    };
  }
};

export default async function SystemsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();

  return <SystemsPageContent workspace={workspace} />;
}
