import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { api } from "~/trpc/server";

export const generateMetadata = async (props: {
  params: { workspaceSlug: string; systemSlug: string };
}): Promise<Metadata> => {
  try {
    const system = await api.system.bySlug(props.params);
    return {
      title: `${system.name} | Ctrlplane`,
      description: `View and manage the ${system.name} system in Ctrlplane.`
    };
  } catch (error) {
    return {
      title: "System | Ctrlplane",
      description: "View and manage systems in Ctrlplane."
    };
  }
};

export default async function SystemsPage(props: {
  params: Promise<{ workspaceSlug: string; systemSlug: string }>;
}) {
  const { workspaceSlug, systemSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();

  return redirect(`/${workspaceSlug}/systems/${systemSlug}/deployments`);
}
