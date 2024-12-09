import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { WorkspaceDeleteSection } from "./WorkspaceDeleteSection";
import { WorkspaceUpdateSection } from "./WorkspaceUpdateSection";

export const metadata: Metadata = { title: "General - Workspace Settings" };

export default async function WorkspaceGeneralSettingsPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();

  return (
    <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-[calc(100vh-40px)] overflow-auto">
      <div className="container mx-auto max-w-2xl space-y-8">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">General</h1>
          <p className="text-sm text-muted-foreground">
            Manage your workspace settings
          </p>
        </div>
        <div className="border-b" />

        <div className="space-y-6">
          <div>General</div>

          <WorkspaceUpdateSection workspace={workspace} />
        </div>

        <div className="border-b" />

        <WorkspaceDeleteSection />
      </div>
    </div>
  );
}
