import type { Metadata } from "next";

import { WorkspaceDeleteSection } from "./WorkspaceDeleteSection";
import { WorkspaceUpdateSection } from "./WorkspaceUpdateSection";

export const metadata: Metadata = { title: "General - Workspace Settings" };

export default function WorkspaceGeneralSettingsPage() {
  return (
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

        <WorkspaceUpdateSection />
      </div>

      <div className="border-b" />

      <WorkspaceDeleteSection />
    </div>
  );
}
