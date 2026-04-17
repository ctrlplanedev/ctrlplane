import type { RouterOutputs } from "@ctrlplane/trpc";
import { FileText } from "lucide-react";
import prettyMs from "pretty-ms";
import { Link, useNavigate } from "react-router";

import { trpc } from "~/api/trpc";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useDeployment } from "./_components/DeploymentProvider";
import { DeploymentsNavbarTabs } from "./_components/DeploymentsNavbarTabs";
import { PlanStatusBadge } from "./_components/plans/PlanStatusBadge";

export function meta() {
  return [
    { title: "Plans - Deployment Details - Ctrlplane" },
    { name: "description", content: "View deployment plans" },
  ];
}

type Plan = RouterOutputs["deployment"]["plans"]["list"][number];

function SourceCell({ plan }: { plan: Plan }) {
  const owner = plan.version.metadata["github/owner"];
  const repo = plan.version.metadata["github/repo"];
  const sha = plan.version.metadata["git/sha"];
  const runId = plan.version.metadata["github/run-id"];

  if (!owner || !repo) {
    return <span className="text-muted-foreground">—</span>;
  }

  const commitShort = sha?.slice(0, 7);
  const repoUrl = `https://github.com/${owner}/${repo}`;

  if (runId)
    return (
      <a
        href={`${repoUrl}/actions/runs/${runId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-xs hover:underline"
      >
        {commitShort ?? `${owner}/${repo}`}
      </a>
    );

  if (sha)
    return (
      <a
        href={`${repoUrl}/commit/${sha}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-xs hover:underline"
      >
        {commitShort}
      </a>
    );

  return <span className="text-muted-foreground">—</span>;
}

function ChangesCell({ summary }: { summary: Plan["summary"] }) {
  if (summary.total === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex gap-3 text-xs">
      {summary.changed > 0 && (
        <span className="text-green-600 dark:text-green-400">
          {summary.changed} changed
        </span>
      )}
      {summary.unchanged > 0 && (
        <span className="text-muted-foreground">
          {summary.unchanged} unchanged
        </span>
      )}
      {summary.errored > 0 && (
        <span className="text-red-600 dark:text-red-400">
          {summary.errored} errored
        </span>
      )}
    </div>
  );
}

function PlansTableHeader() {
  return (
    <TableHeader>
      <TableRow className="bg-muted/50">
        <TableHead className="font-medium">Version</TableHead>
        <TableHead className="font-medium">Status</TableHead>
        <TableHead className="font-medium">Targets</TableHead>
        <TableHead className="font-medium">Changes</TableHead>
        <TableHead className="font-medium">Source</TableHead>
        <TableHead className="font-medium">Created</TableHead>
        <TableHead className="font-medium">Expires</TableHead>
      </TableRow>
    </TableHeader>
  );
}

function PlansTableRow({
  plan,
  onSelect,
}: {
  plan: Plan;
  onSelect: () => void;
}) {
  const now = Date.now();
  const createdAgo = prettyMs(now - new Date(plan.createdAt).getTime(), {
    compact: true,
  });
  const expiresAt = new Date(plan.expiresAt).getTime();
  const expiresIn =
    expiresAt > now
      ? `in ${prettyMs(expiresAt - now, { compact: true })}`
      : "expired";

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={onSelect}
    >
      <TableCell className="font-mono">{plan.version.tag}</TableCell>
      <TableCell>
        <PlanStatusBadge status={plan.status} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {plan.summary.total}
      </TableCell>
      <TableCell>
        <ChangesCell summary={plan.summary} />
      </TableCell>
      <TableCell>
        <SourceCell plan={plan} />
      </TableCell>
      <TableCell className="text-muted-foreground">{createdAgo} ago</TableCell>
      <TableCell className="text-muted-foreground">{expiresIn}</TableCell>
    </TableRow>
  );
}

function NoPlans() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center space-y-4 text-center">
        <div className="rounded-full bg-muted p-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold">No plans yet</h3>
          <p className="text-sm text-muted-foreground">
            Plans will appear here when a pull request triggers a dry run
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DeploymentPlans() {
  const { workspace } = useWorkspace();
  const { deployment } = useDeployment();
  const navigate = useNavigate();

  const plansQuery = trpc.deployment.plans.list.useQuery(
    { deploymentId: deployment.id, limit: 100, offset: 0 },
    { refetchInterval: 5000 },
  );

  const plans = plansQuery.data ?? [];

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b pr-4">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <Link to={`/${workspace.slug}/deployments`}>Deployments</Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <Link to={`/${workspace.slug}/deployments/${deployment.id}`}>
                  {deployment.name}
                </Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbPage>Plans</BreadcrumbPage>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-4">
          <DeploymentsNavbarTabs />
        </div>
      </header>

      {plans.length === 0 && !plansQuery.isLoading ? (
        <NoPlans />
      ) : (
        <Table>
          <PlansTableHeader />
          <TableBody>
            {plans.map((plan) => (
              <PlansTableRow
                key={plan.id}
                plan={plan}
                onSelect={() =>
                  navigate(
                    `/${workspace.slug}/deployments/${deployment.id}/plans/${plan.id}`,
                  )
                }
              />
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
