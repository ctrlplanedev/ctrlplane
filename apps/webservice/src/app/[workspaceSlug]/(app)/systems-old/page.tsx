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

export default async function SystemsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
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
          <SystemsList workspace={workspace} systemsCount={systemsAll.total} />
        </>
      )}
    </>
  );
}
