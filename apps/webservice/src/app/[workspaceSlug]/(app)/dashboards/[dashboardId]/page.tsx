import { notFound } from "next/navigation";

import { ScrollArea } from "@ctrlplane/ui/scroll-area";

import { api } from "~/trpc/server";
import { Dashboard } from "../Dashboard";
import { DashboardProvider } from "../DashboardContext";
import { DashboardTitle } from "./DashboardTitle";
import { WidgetMenu } from "./WidgetMenu";

export default async function DashboardPage(
  props: {
    params: Promise<{ workspaceSlug: string; dashboardId: string }>;
  }
) {
  const params = await props.params;
  const workspace = await api.workspace
    .bySlug(params.workspaceSlug)
    .catch(() => null);
  if (workspace == null) notFound();

  const dashboard = await api.dashboard.get(params.dashboardId);
  if (dashboard == null) notFound();
  return (
    <DashboardProvider dashboardId={params.dashboardId}>
      <DashboardTitle />
      <div className="flex h-[calc(100vh-53px)] flex-col">
        <WidgetMenu />

        <ScrollArea className="flex-grow">
          <Dashboard workspace={workspace} />
        </ScrollArea>
      </div>
    </DashboardProvider>
  );
}
