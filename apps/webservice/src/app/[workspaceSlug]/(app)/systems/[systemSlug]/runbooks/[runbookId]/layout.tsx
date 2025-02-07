import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { SystemBreadcrumbNavbar } from "../../../SystemsBreadcrumb";
import { TopNav } from "../../../TopNav";
import { RunbookNavBar } from "./RunbookNavBar";

type PageProps = {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    runbookId: string;
  }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const runbook = await api.runbook.byId(params.runbookId);
  if (runbook == null) return notFound();

  return {
    title: `${runbook.name} | Runbooks`,
  };
}

export default async function RunbookLayout(
  props: {
    children: React.ReactNode;
  } & PageProps,
) {
  const params = await props.params;

  const { children } = props;

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

      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-[calc(100vh-53px-49px)] overflow-auto">
        {children}
      </div>
    </>
  );
}
