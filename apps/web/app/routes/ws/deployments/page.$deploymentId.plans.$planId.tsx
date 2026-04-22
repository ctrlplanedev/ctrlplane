import type { RouterOutputs } from "@ctrlplane/trpc";
import { FileText } from "lucide-react";
import { Link, useParams } from "react-router";

import { trpc } from "~/api/trpc";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
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
import { PlanDiffDialog } from "./_components/plans/PlanDiffDialog";
import { PlanStatusBadge } from "./_components/plans/PlanStatusBadge";
import { usePlanResultParam } from "./_hooks/usePlanResultParam";

export function meta() {
  return [
    { title: "Plan Details - Ctrlplane" },
    { name: "description", content: "View plan results" },
  ];
}

type Result = RouterOutputs["deployment"]["plans"]["results"][number];

function resultTitle(result: Result) {
  return `${result.environment.name} · ${result.resource.name} · ${result.agent.name}`;
}

function ChangesCell({
  result,
  onViewDiff,
}: {
  result: Result;
  onViewDiff: (resultId: string) => void;
}) {
  if (result.status === "computing")
    return <span className="text-muted-foreground">—</span>;
  if (result.status === "errored")
    return (
      <span
        className="text-red-600 dark:text-red-400"
        title={result.message ?? undefined}
      >
        Errored
      </span>
    );
  if (result.status === "unsupported")
    return <span className="text-muted-foreground">Unsupported</span>;
  if (result.hasChanges === true)
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-6 cursor-pointer hover:bg-accent hover:text-accent-foreground"
        onClick={() => onViewDiff(result.resultId)}
      >
        View diff
      </Button>
    );
  if (result.hasChanges === false)
    return <span className="text-muted-foreground">No changes</span>;
  return <span className="text-muted-foreground">—</span>;
}

function ResultsTableHeader() {
  return (
    <TableHeader>
      <TableRow className="bg-muted/50">
        <TableHead className="font-medium">Environment</TableHead>
        <TableHead className="font-medium">Resource</TableHead>
        <TableHead className="font-medium">Agent</TableHead>
        <TableHead className="font-medium">Status</TableHead>
        <TableHead className="font-medium">Changes</TableHead>
      </TableRow>
    </TableHeader>
  );
}

function ResultsTableRow({
  result,
  onViewDiff,
}: {
  result: Result;
  onViewDiff: (resultId: string) => void;
}) {
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell>{result.environment.name}</TableCell>
      <TableCell>{result.resource.name}</TableCell>
      <TableCell>{result.agent.name}</TableCell>
      <TableCell>
        <PlanStatusBadge status={result.status} />
      </TableCell>
      <TableCell>
        <ChangesCell result={result} onViewDiff={onViewDiff} />
      </TableCell>
    </TableRow>
  );
}

function NoResults() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center space-y-4 text-center">
        <div className="rounded-full bg-muted p-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold">No results</h3>
          <p className="text-sm text-muted-foreground">
            This plan has no release targets
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DeploymentPlanDetail() {
  const { workspace } = useWorkspace();
  const { deployment } = useDeployment();
  const { planId } = useParams<{ planId: string }>();
  const { resultId, openResult, closeResult } = usePlanResultParam();

  const resultsQuery = trpc.deployment.plans.results.useQuery(
    { deploymentId: deployment.id, planId: planId! },
    { enabled: !!planId, refetchInterval: 5000 },
  );

  const results = resultsQuery.data ?? [];
  const activeResult = results.find((r) => r.resultId === resultId);

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
              <BreadcrumbItem>
                <Link
                  to={`/${workspace.slug}/deployments/${deployment.id}/plans`}
                >
                  Plans
                </Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbPage className="font-mono">{planId}</BreadcrumbPage>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-4">
          <DeploymentsNavbarTabs />
        </div>
      </header>

      {results.length === 0 && !resultsQuery.isLoading ? (
        <NoResults />
      ) : (
        <Table>
          <ResultsTableHeader />
          <TableBody>
            {results.map((r) => (
              <ResultsTableRow
                key={r.resultId}
                result={r}
                onViewDiff={openResult}
              />
            ))}
          </TableBody>
        </Table>
      )}

      <PlanDiffDialog
        deploymentId={deployment.id}
        resultId={resultId}
        title={activeResult ? resultTitle(activeResult) : ""}
        open={resultId != null}
        onOpenChange={(o) => {
          if (!o) closeResult();
        }}
      />
    </>
  );
}
