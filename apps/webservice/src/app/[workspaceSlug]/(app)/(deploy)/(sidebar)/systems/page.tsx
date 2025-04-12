import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { SystemsPageContent } from "./SystemsPageContent";

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}): Promise<Metadata> => {
  const { workspaceSlug } = await params;

  return api.workspace
    .bySlug(workspaceSlug)
    .then((workspace) => ({
      title: `Systems | ${workspace?.name ?? workspaceSlug} | Ctrlplane`,
      description: `Manage and deploy systems for the ${workspace?.name ?? workspaceSlug} workspace.`,
    }))
    .catch(() => ({
      title: "Systems | Ctrlplane",
      description: "Manage and deploy your systems with Ctrlplane.",
    }));
};

export default async function SystemsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();

  return <SystemsPageContent workspace={workspace} />;
}
