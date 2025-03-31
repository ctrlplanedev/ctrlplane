import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { EnvironmentPageContent } from "./EnvironmentPageContent";

export const generateMetadata = async (props: {
  params: { workspaceSlug: string; systemSlug: string };
}): Promise<Metadata> => {
  try {
    const system = await api.system.bySlug(props.params);
    return {
      title: `Environments | ${system.name} | Ctrlplane`,
      description: `Manage environments for the ${system.name} system in Ctrlplane.`,
    };
  } catch {
    return {
      title: "Environments | Ctrlplane",
      description: "Manage deployment environments in Ctrlplane.",
    };
  }
};

export default async function EnvironmentsPage(props: {
  params: Promise<{ workspaceSlug: string; systemSlug: string }>;
}) {
  const params = await props.params;
  const system = await api.system.bySlug(params).catch(() => null);
  if (system == null) notFound();

  return <EnvironmentPageContent system={system} />;
}
