import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { SystemBreadcrumbNavbar } from "../../../SystemsBreadcrumb";
import { TopNav } from "../../../TopNav";
import { RunbookNavBar } from "./RunbookNavBar";

type PageProps = {
  params: { workspaceSlug: string; systemSlug: string; runbookId: string };
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const runbook = await api.runbook.byId(params.runbookId);
  if (runbook == null) return notFound();

  return {
    title: `${runbook.name} | Runbooks`,
  };
}

export default async function RunbookLayout({
  children,
  params,
}: {
  children: React.ReactNode;
} & PageProps) {
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) return notFound();

  const runbook = await api.runbook.byId(params.runbookId);
  if (runbook == null) return notFound();

  const { runbookId } = params;
  const { total } = await api.runbook.jobs({ runbookId, limit: 0 });

  return (
    <>
      <TopNav>
        <div className="flex items-center">
          <SystemBreadcrumbNavbar params={params} />
        </div>
      </TopNav>
      <RunbookNavBar totalJobs={total} runbook={runbook} />

      <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 h-[calc(100vh-53px-49px)] overflow-auto">
        {children}
      </div>
    </>
  );
}
