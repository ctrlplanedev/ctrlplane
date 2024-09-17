import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { SystemBreadcrumbNavbar } from "../../SystemsBreadcrumb";
import { TopNav } from "../../TopNav";
import { RunbookGettingStarted } from "./RunbookGettingStarted";
import { RunbookRow } from "./RunbookRow";

export const metadata: Metadata = { title: "Runbooks - Systems" };

export default async function Runbooks({ params }: { params: any }) {
  const system = await api.system.bySlug(params).catch(notFound);
  const runbooks = await api.runbook.bySystemId(system.id);

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
            <RunbookRow key={r.id} runbook={r} />
          ))}
        </>
      )}
    </>
  );
}
