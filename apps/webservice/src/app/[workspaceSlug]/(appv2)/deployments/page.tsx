import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { DeploymentsPageContent } from "./DeploymentsPageContent";

export const metadata: Metadata = {
  title: "Deployments | Ctrlplane",
};

type Props = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function DeploymentsPage(props: Props) {
  const { workspaceSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();

  return <DeploymentsPageContent workspaceId={workspace.id} />;
}
