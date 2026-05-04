import type { RouterOutputs } from "@ctrlplane/trpc";
import { useState } from "react";
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
import { cn } from "~/lib/utils";
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

type Result = RouterOutputs["deployment"]["plans"]["results"]["items"][number];

function resultTitle(result: Result) {
  return `${result.environment.name} · ${result.resource.name} · ${result.agent.name}`;
}

function DiffStats({
  stats,
}: {
  stats: { added: number; removed: number } | null;
}) {
  if (stats == null) return null;
  return (
    <span className="font-mono text-xs">
      {stats.added > 0 && (
        <span className="text-green-600 dark:text-green-400">
          +{stats.added}
        </span>
      )}
      {stats.added > 0 && stats.removed > 0 && (
        <span className="text-muted-foreground"> </span>
      )}
      {stats.removed > 0 && (
        <span className="text-red-600 dark:text-red-400">-{stats.removed}</span>
      )}
    </span>
  );
}

function ChangesCell({ result }: { result: Result }) {
  if (result.status === "computing")
    return <span className="text-muted-foreground">—</span>;
  if (result.status === "errored")
    return <span className="text-red-600 dark:text-red-400">Errored</span>;
  if (result.status === "unsupported")
    return <span className="text-muted-foreground">Unsupported</span>;
  if (result.hasChanges === true) return <DiffStats stats={result.diffStats} />;
  if (result.hasChanges === false)
    return <span className="text-muted-foreground">No changes</span>;
  return <span className="text-muted-foreground">—</span>;
}

function ValidationsCell({
  validations,
  onClick,
}: {
  validations: Result["validations"];
  onClick: () => void;
}) {
  if (validations.total === 0)
    return <span className="text-muted-foreground">—</span>;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex items-center gap-2 text-xs hover:underline"
    >
      {validations.failed > 0 && (
        <span className="text-red-600 dark:text-red-400">
          {validations.failed} failed
        </span>
      )}
      {validations.passed > 0 && (
        <span className="text-muted-foreground">
          {validations.passed} passed
        </span>
      )}
    </button>
  );
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
        <TableHead className="font-medium">Validations</TableHead>
      </TableRow>
    </TableHeader>
  );
}

function ResultsTableRow({
  result,
  onOpenResult,
}: {
  result: Result;
  onOpenResult: (resultId: string, tab?: "diff" | "validations") => void;
}) {
  const hasChanges = result.hasChanges === true;
  const hasValidations = result.validations.total > 0;
  const isClickable = hasChanges || hasValidations;
  const defaultTab = hasChanges ? "diff" : "validations";
  return (
    <TableRow
      className={cn("hover:bg-muted/50", isClickable && "cursor-pointer")}
      onClick={
        isClickable
          ? () => onOpenResult(result.resultId, defaultTab)
          : undefined
      }
    >
      <TableCell>{result.environment.name}</TableCell>
      <TableCell>{result.resource.name}</TableCell>
      <TableCell>{result.agent.name}</TableCell>
      <TableCell>
        <PlanStatusBadge {...result} />
      </TableCell>
      <TableCell>
        <ChangesCell result={result} />
      </TableCell>
      <TableCell>
        <ValidationsCell
          validations={result.validations}
          onClick={() => onOpenResult(result.resultId, "validations")}
        />
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
  const [initialTab, setInitialTab] = useState<"diff" | "validations">("diff");

  const resultsQuery = trpc.deployment.plans.results.useQuery(
    { deploymentId: deployment.id, planId: planId! },
    { enabled: !!planId, refetchInterval: 5000 },
  );

  const version = resultsQuery.data?.version;
  const results = resultsQuery.data?.items ?? [];
  const activeResult = results.find((r) => r.resultId === resultId);

  const handleOpenResult = (
    id: string,
    tab: "diff" | "validations" = "diff",
  ) => {
    setInitialTab(tab);
    openResult(id);
  };

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
              <BreadcrumbPage className="max-w-xs truncate font-mono">
                {version?.name ?? version?.tag ?? planId}
              </BreadcrumbPage>
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
                onOpenResult={handleOpenResult}
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
        initialTab={initialTab}
        onOpenChange={(o) => {
          if (!o) closeResult();
        }}
      />
    </>
  );
}
