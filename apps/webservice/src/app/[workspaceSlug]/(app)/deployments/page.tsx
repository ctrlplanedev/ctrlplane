import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconRocket } from "@tabler/icons-react";

import { api } from "~/trpc/server";
import { DeploymentsCard } from "./Card";

export const metadata: Metadata = {
  title: "Deployments | Ctrlplane",
};

export default async function DeploymentsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  const { workspaceSlug } = params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();
  return (
    <div>
      <div className="flex items-center gap-2 border-b px-2">
        <div className="flex items-center gap-2 p-3">
          <IconRocket className="h-4 w-4" /> Deployments
        </div>
      </div>

      <DeploymentsCard workspaceId={workspace.id} />
    </div>
  );
}
