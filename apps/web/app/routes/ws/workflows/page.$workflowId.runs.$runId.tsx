import type { RouterOutputs } from "@ctrlplane/trpc";
import { formatDistanceToNowStrict } from "date-fns";
import { ExternalLink } from "lucide-react";
import { Link, useParams } from "react-router";

import { trpc } from "~/api/trpc";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { buttonVariants } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Spinner } from "~/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { JobStatusBadge } from "../_components/JobStatusBadge";

type WorkflowRunJob = RouterOutputs["workflows"]["runs"]["get"]["jobs"][number];

function timeAgo(date: Date | string | null) {
  if (date == null) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

function RunPageHeader({
  workflowName,
  runId,
}: {
  workflowName: string;
  runId: string;
}) {
  const { workspace } = useWorkspace();
  const { workflowId } = useParams<{ workflowId: string }>();
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b">
      <div className="flex w-full items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={`/${workspace.slug}/workflows`}>Workflows</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={`/${workspace.slug}/workflows/${workflowId}`}>
                  {workflowName}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{runId.slice(0, 8)}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}

function InputsSection({ inputs }: { inputs: unknown }) {
  const entries = Object.entries((inputs as Record<string, unknown>) ?? {});
  if (entries.length === 0)
    return <p className="text-sm text-muted-foreground">No inputs.</p>;

  return (
    <div className="grid grid-cols-[120px_1fr] gap-y-1 text-sm">
      {entries.map(([key, value]) => (
        <>
          <span key={`${key}-label`} className="text-muted-foreground">
            {key}
          </span>
          <span key={`${key}-value`} className="font-mono text-xs">
            {JSON.stringify(value)}
          </span>
        </>
      ))}
    </div>
  );
}

function LinksCell({ metadata }: { metadata: Record<string, string> }) {
  const links: Record<string, string> =
    metadata["ctrlplane/links"] != null
      ? JSON.parse(metadata["ctrlplane/links"])
      : {};

  return (
    <TableCell>
      <div className="flex gap-1">
        {Object.entries(links).map(([label, url]) => (
          <a
            key={label}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "max-w-30 flex h-6 items-center gap-1.5 px-2 py-0",
            )}
          >
            <span className="truncate">{label}</span>
            <ExternalLink className="size-3 shrink-0" />
          </a>
        ))}
      </div>
    </TableCell>
  );
}

function JobRow({ job }: { job: WorkflowRunJob }) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {job.id.slice(0, 8)}
      </TableCell>
      <TableCell>{job.jobAgentName ?? "-"}</TableCell>
      <TableCell className="text-muted-foreground">
        {job.jobAgentType ?? "-"}
      </TableCell>
      <TableCell>
        <JobStatusBadge status={job.status} message={job.message} />
      </TableCell>
      <LinksCell metadata={job.metadata} />
      <TableCell className="text-muted-foreground">
        {timeAgo(job.createdAt)}
      </TableCell>
    </TableRow>
  );
}

export default function WorkflowRunDetailPage() {
  const { workspace } = useWorkspace();
  const { workflowId, runId } = useParams<{
    workflowId: string;
    runId: string;
  }>();

  const { data: workflow } = trpc.workflows.get.useQuery(
    { workspaceId: workspace.id, workflowId: workflowId! },
    { enabled: workflowId != null },
  );

  const { data: run, isLoading } = trpc.workflows.runs.get.useQuery(
    { workflowRunId: runId! },
    { enabled: runId != null },
  );

  const workflowName = workflow?.name ?? "...";

  if (isLoading) {
    return (
      <>
        <RunPageHeader workflowName={workflowName} runId={runId ?? ""} />
        <div className="flex h-64 items-center justify-center">
          <Spinner className="size-6" />
        </div>
      </>
    );
  }

  if (run == null) throw new Error("Workflow run not found");

  return (
    <>
      <RunPageHeader workflowName={workflowName} runId={run.id} />

      <main className="flex-1 space-y-8 overflow-auto p-6">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Inputs</h2>
          <InputsSection inputs={run.inputs} />
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Jobs</h2>
          {run.jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No jobs were dispatched for this run.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Links</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {run.jobs.map((job) => (
                    <JobRow key={job.id} job={job} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
