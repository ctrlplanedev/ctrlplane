import { notFound } from "next/navigation";
import _ from "lodash";

import { api } from "~/trpc/server";
import { SystemGettingStarted } from "./SystemGettingStarted";
import { SystemBreadcrumbNavbar } from "./SystemsBreadcrumb";
import { SystemsList } from "./SystemsList";
import { TopNav } from "./TopNav";

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
        <SystemGettingStarted workspaceId={workspace.id} />
      ) : (
        <SystemsList workspace={workspace} />
      )}
    </>
  );
}
