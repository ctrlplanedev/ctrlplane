import Link from "next/link";
import { notFound } from "next/navigation";
import { IconMenu2 } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { buttonVariants } from "@ctrlplane/ui/button";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/server";
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
        <div className="flex items-center gap-2">
          <SidebarTrigger name={Sidebars.System}>
            <IconMenu2 className="h-4 w-4" />
          </SidebarTrigger>
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbPage>Runbooks</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

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
