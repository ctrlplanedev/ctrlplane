import type { Metadata } from "next";
import { notFound } from "next/navigation";
import _ from "lodash";

import { Separator } from "@ctrlplane/ui/separator";

import { api } from "~/trpc/server";
import { JobHistoryChart } from "./JobHistoryChart";
import { SystemGettingStarted } from "./SystemGettingStarted";
import { SystemBreadcrumbNavbar } from "./SystemsBreadcrumb";
import { SystemsList } from "./SystemsList";
import { TopNav } from "./TopNav";

export const metadata: Metadata = {
  title: "Systems | Ctrlplane",
};

export default async function SystemsPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const { workspaceSlug } = params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();

  const systemsAll = await api.system.list({ workspaceId: workspace.id });
  return (
    <>
      <TopNav>
        <SystemBreadcrumbNavbar params={params} />
      </TopNav>
      {systemsAll.total === 0 ? (
        <SystemGettingStarted workspace={workspace} />
      ) : (
        <>
          <JobHistoryChart workspace={workspace} />
          <Separator />
          <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 h-[calc(100vh-110px)] overflow-auto">
            <SystemsList
              workspace={workspace}
              systemsCount={systemsAll.total}
            />
          </div>
        </>
      )}
    </>
  );
}
