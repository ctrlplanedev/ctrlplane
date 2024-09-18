import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { SystemBreadcrumbNavbar } from "../../SystemsBreadcrumb";
import { TopNav } from "../../TopNav";
import { RunbookGettingStarted } from "./RunbookGettingStarted";
import { RunbookRow } from "./RunbookRow";

export const metadata: Metadata = { title: "Runbooks - Systems" };

export default async function Runbooks({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string };
}) {
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) return notFound();
  const system = await api.system.bySlug(params).catch(notFound);
  const runbooks = await api.runbook.bySystemId(system.id);
  const jobAgents = await api.job.agent.byWorkspaceId(workspace.id);

  return (
    <>
      <TopNav>
        <SystemBreadcrumbNavbar params={params} />
      </TopNav>

      {runbooks.length === 0 ? (
        <RunbookGettingStarted {...params} />
      ) : (
        <>
          {runbooks.map((r) => (
            <RunbookRow
              key={r.id}
              runbook={r}
              jobAgents={jobAgents}
              workspace={workspace}
            />
          ))}
        </>
      )}
    </>
  );
}
