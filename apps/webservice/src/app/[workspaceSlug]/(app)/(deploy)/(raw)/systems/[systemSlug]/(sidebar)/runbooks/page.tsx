import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@ctrlplane/ui/button";

import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { api } from "~/trpc/server";
import { SystemBreadcrumb } from "../_components/SystemBreadcrumb";
import { RunbookGettingStarted } from "./RunbookGettingStarted";
import { RunbookRow } from "./RunbookRow";

export default async function RunbooksPage(props: {
  params: Promise<{ workspaceSlug: string; systemSlug: string }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) return notFound();
  const system = await api.system.bySlug(params).catch(notFound);
  const runbooks = await api.runbook.bySystemId(system.id);
  const jobAgents = await api.job.agent.byWorkspaceId(workspace.id);
  return (
    <div>
      <PageHeader className="flex w-full items-center justify-between">
        <SystemBreadcrumb system={system} page="Runbooks" />

        <Link
          href={`/${params.workspaceSlug}/systems/${params.systemSlug}/runbooks/create`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Create Runbook
        </Link>
      </PageHeader>

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
    </div>
  );
}
