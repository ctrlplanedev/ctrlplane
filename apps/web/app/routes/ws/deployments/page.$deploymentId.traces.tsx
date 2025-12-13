import { useMemo, useState } from "react";
import {
  Activity,
  CheckCircleIcon,
  ClockIcon,
  FileQuestionIcon,
  Search,
  X,
  XCircleIcon,
} from "lucide-react";
import { Link } from "react-router";

import type { DeploymentTraceSpan } from "./_components/trace-utils";
import type { TraceFiltersState } from "./_components/TraceFilters";
import { trpc } from "~/api/trpc";
import { Badge } from "~/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { cn } from "~/lib/utils";
import { useDeployment } from "./_components/DeploymentProvider";
import { DeploymentsNavbarTabs } from "./_components/DeploymentsNavbarTabs";
import {
  buildTraceTree,
  calculateSpanDuration,
  formatDuration,
  formatTimestamp,
  getPhaseColor,
  getStatusColor,
} from "./_components/trace-utils";
import { TraceFilters } from "./_components/TraceFilters";
import { TraceTree } from "./_components/TraceTree";

export function meta() {
  return [
    { title: "Traces - Deployment Details - Ctrlplane" },
    { name: "description", content: "View deployment execution traces" },
  ];
}

const StatusIcon: Record<string, React.ReactNode> = {
  completed: <CheckCircleIcon className="h-4 w-4 text-green-500" />,
  denied: <XCircleIcon className="h-4 w-4 text-red-500" />,
  failed: <XCircleIcon className="h-4 w-4 text-red-500" />,
  error: <XCircleIcon className="h-4 w-4 text-red-500" />,
  pending: <ClockIcon className="h-4 w-4 text-yellow-500" />,
  running: <ClockIcon className="h-4 w-4 text-yellow-500" />,
  unknown: <FileQuestionIcon className="h-4 w-4 text-gray-500" />,
};

interface RootTraceCardProps {
  trace: DeploymentTraceSpan;
  isSelected: boolean;
  onSelect: () => void;
  releaseTarget?: {
    resource: { name: string };
    environment: { name: string };
  } | null;
}

function RootTraceCard({
  releaseTarget,
  trace,
  isSelected,
  onSelect,
}: RootTraceCardProps) {
  const icon = StatusIcon[trace.status ?? "unknown"];
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent",
        isSelected && "border-primary bg-accent",
      )}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbPage>
                  {releaseTarget?.environment.name}
                </BreadcrumbPage>
                <BreadcrumbSeparator />
                <BreadcrumbPage>{releaseTarget?.resource.name}</BreadcrumbPage>
                <BreadcrumbSeparator />
                <BreadcrumbPage className="flex items-center gap-2">
                  {trace.name} {icon}
                </BreadcrumbPage>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(trace.startTime)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function NoTraces() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center space-y-4 text-center">
        <div className="rounded-full bg-muted p-4">
          <Activity className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold">No traces found</h3>
          <p className="text-sm text-muted-foreground">
            Traces will appear here once deployments are executed
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DeploymentTraces() {
  const { workspace } = useWorkspace();
  const { deployment } = useDeployment();

  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<TraceFiltersState>({});
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);

  // Fetch deployment versions for filtering
  const versionsQuery = trpc.deployment.versions.useQuery({
    workspaceId: workspace.id,
    deploymentId: deployment.id,
    limit: 100,
    offset: 0,
  });

  // Fetch release targets for filtering
  const releaseTargetsQuery = trpc.deployment.releaseTargets.useQuery({
    workspaceId: workspace.id,
    deploymentId: deployment.id,
    limit: 1000,
    offset: 0,
  });
  const releaseTargetsMap = useMemo(() => {
    return Object.fromEntries(
      releaseTargetsQuery.data?.items.map((rt) => [
        `${rt.resource.id}-${rt.environment.id}-${rt.deployment.id}`,
        rt,
      ]) ?? [],
    );
  }, [releaseTargetsQuery.data?.items]);

  // Fetch root traces with filters
  const tracesQuery = trpc.deploymentTraces.getUniqueTraces.useQuery(
    {
      workspaceId: workspace.id,
      deploymentId: deployment.id,
      limit: 100,
      offset: 0,
      releaseId: filters.releaseId ?? undefined,
      releaseTargetKey: filters.releaseTargetKey ?? undefined,
      jobId: filters.jobId ?? undefined,
    },
    { refetchInterval: 5000 },
  );

  // Fetch full trace details when a trace is selected
  const selectedTraceQuery = trpc.deploymentTraces.byTraceId.useQuery(
    {
      workspaceId: workspace.id,
      traceId: selectedTraceId!,
    },
    {
      enabled: !!selectedTraceId,
    },
  );

  const traces = tracesQuery.data ?? [];
  const versions = versionsQuery.data?.items ?? [];
  const releaseTargets = releaseTargetsQuery.data?.items ?? [];

  // Filter traces by search query
  const filteredTraces = traces.filter((trace) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      trace.name.toLowerCase().includes(query) ||
      trace.traceId.toLowerCase().includes(query) ||
      (trace.releaseId ?? "").toLowerCase().includes(query) ||
      (trace.releaseTargetKey ?? "").toLowerCase().includes(query) ||
      (trace.jobId ?? "").toLowerCase().includes(query)
    );
  });

  // Build tree from selected trace
  const traceTree =
    selectedTraceQuery.data && selectedTraceQuery.data.length > 0
      ? buildTraceTree(selectedTraceQuery.data)
      : [];

  // Find selected span
  const selectedSpan = selectedTraceQuery.data?.find(
    (span) => span.spanId === selectedSpanId,
  );

  // Prepare data for filters
  const releaseOptions = versions.map((v) => ({
    id: v.id,
    name: v.name,
    version: v.tag,
  }));

  const releaseTargetOptions = releaseTargets.map((rt) => ({
    key: `${rt.releaseTarget.resourceId}-${rt.releaseTarget.environmentId}-${rt.releaseTarget.deploymentId}`,
    name: `${rt.environment.name}/${rt.resource.name}`,
  }));

  const handleTraceSelect = (traceId: string) => {
    if (selectedTraceId === traceId) {
      setSelectedTraceId(null);
      setSelectedSpanId(null);
    } else {
      setSelectedTraceId(traceId);
      setSelectedSpanId(null);
    }
  };

  const handleSpanSelect = (span: DeploymentTraceSpan) => {
    setSelectedSpanId(span.spanId);
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
              <BreadcrumbPage>Traces</BreadcrumbPage>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-4">
          <DeploymentsNavbarTabs />
        </div>
      </header>

      <div className="border-b bg-background p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search traces by name, trace ID, release, target, or job..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <TraceFilters
            filters={filters}
            onFiltersChange={setFilters}
            releases={releaseOptions}
            releaseTargets={releaseTargetOptions}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {filteredTraces.length === 0 && !tracesQuery.isLoading ? (
          <NoTraces />
        ) : (
          <div className="flex h-full w-full">
            {/* Left Panel - Root Traces List */}
            <div
              className={cn(
                "h-full overflow-auto border-r",
                selectedTraceId ? "w-[35%]" : "w-full",
              )}
            >
              <div className="space-y-3 p-4">
                {filteredTraces.map((trace) => (
                  <RootTraceCard
                    key={trace.id}
                    releaseTarget={
                      trace.releaseTargetKey &&
                      trace.releaseTargetKey in releaseTargetsMap
                        ? releaseTargetsMap[trace.releaseTargetKey]
                        : null
                    }
                    trace={trace}
                    isSelected={selectedTraceId === trace.traceId}
                    onSelect={() => handleTraceSelect(trace.traceId)}
                  />
                ))}
              </div>
            </div>

            {/* Middle Panel - Trace Tree */}
            {selectedTraceId && (
              <div
                className={cn(
                  "flex h-full flex-col border-r",
                  selectedSpanId ? "w-[40%]" : "w-[65%]",
                )}
              >
                <div className="border-b px-4 py-3">
                  <h3 className="font-semibold">Trace Details</h3>
                  <p className="text-xs text-muted-foreground">
                    Click on a span to view details
                  </p>
                </div>
                <div className="flex-1 overflow-auto">
                  <div className="p-4">
                    {selectedTraceQuery.isLoading ? (
                      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                        Loading trace...
                      </div>
                    ) : (
                      <TraceTree
                        nodes={traceTree}
                        onSpanSelect={handleSpanSelect}
                        selectedSpanId={selectedSpanId ?? undefined}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Right Panel - Span Details */}
            {selectedSpanId && selectedSpan && (
              <div className="flex h-full w-[25%] flex-col">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h3 className="font-semibold">Span Details</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSpanId(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-auto">
                  <div className="space-y-6 p-4">
                    {/* Basic Information */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">
                        Basic Information
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Name:</span>
                          <div className="font-medium">{selectedSpan.name}</div>
                        </div>

                        <div>
                          <span className="text-muted-foreground">
                            Span ID:
                          </span>
                          <div className="font-mono text-xs">
                            {selectedSpan.spanId}
                          </div>
                        </div>

                        <div>
                          <span className="text-muted-foreground">
                            Trace ID:
                          </span>
                          <div className="font-mono text-xs">
                            {selectedSpan.traceId}
                          </div>
                        </div>

                        {selectedSpan.parentSpanId && (
                          <div>
                            <span className="text-muted-foreground">
                              Parent Span ID:
                            </span>
                            <div className="font-mono text-xs">
                              {selectedSpan.parentSpanId}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Timing */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">Timing</h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">
                            Start Time:
                          </span>
                          <div>{formatTimestamp(selectedSpan.startTime)}</div>
                        </div>

                        {selectedSpan.endTime && (
                          <div>
                            <span className="text-muted-foreground">
                              End Time:
                            </span>
                            <div>{formatTimestamp(selectedSpan.endTime)}</div>
                          </div>
                        )}

                        <div>
                          <span className="text-muted-foreground">
                            Duration:
                          </span>
                          <div className="font-medium">
                            {formatDuration(
                              calculateSpanDuration(selectedSpan),
                            )}
                          </div>
                        </div>

                        {selectedSpan.depth !== null && (
                          <div>
                            <span className="text-muted-foreground">
                              Depth:
                            </span>
                            <div>{selectedSpan.depth}</div>
                          </div>
                        )}

                        {selectedSpan.sequence !== null && (
                          <div>
                            <span className="text-muted-foreground">
                              Sequence:
                            </span>
                            <div>{selectedSpan.sequence}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Status & Phase */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">Status & Phase</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedSpan.phase && (
                          <Badge
                            className={cn(
                              "text-white",
                              getPhaseColor(selectedSpan.phase),
                            )}
                          >
                            {selectedSpan.phase}
                          </Badge>
                        )}

                        {selectedSpan.status && (
                          <Badge
                            className={cn(
                              "text-white",
                              getStatusColor(selectedSpan.status),
                            )}
                          >
                            {selectedSpan.status}
                          </Badge>
                        )}

                        {selectedSpan.nodeType && (
                          <Badge variant="outline">
                            {selectedSpan.nodeType}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Deployment Context */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">
                        Deployment Context
                      </h4>
                      <div className="space-y-2 text-sm">
                        {selectedSpan.releaseId && (
                          <div>
                            <span className="text-muted-foreground">
                              Release ID:
                            </span>
                            <div className="font-mono text-xs">
                              {selectedSpan.releaseId}
                            </div>
                          </div>
                        )}

                        {selectedSpan.releaseTargetKey && (
                          <div>
                            <span className="text-muted-foreground">
                              Release Target:
                            </span>
                            <div className="font-mono text-xs">
                              {selectedSpan.releaseTargetKey}
                            </div>
                          </div>
                        )}

                        {selectedSpan.jobId && (
                          <div>
                            <span className="text-muted-foreground">
                              Job ID:
                            </span>
                            <div className="font-mono text-xs">
                              {selectedSpan.jobId}
                            </div>
                          </div>
                        )}

                        {selectedSpan.parentTraceId && (
                          <div>
                            <span className="text-muted-foreground">
                              Parent Trace ID:
                            </span>
                            <div className="font-mono text-xs">
                              {selectedSpan.parentTraceId}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Attributes */}
                    {selectedSpan.attributes &&
                      Object.keys(selectedSpan.attributes).length > 0 && (
                        <>
                          <Separator />
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold">
                              Attributes
                            </h4>
                            <div className="space-y-2 text-sm">
                              {Object.entries(selectedSpan.attributes).map(
                                ([key, value]) => (
                                  <div key={key}>
                                    <span className="text-muted-foreground">
                                      {key}:
                                    </span>
                                    <div className="mt-1 overflow-auto rounded bg-muted p-2 font-mono text-xs">
                                      {typeof value === "object"
                                        ? JSON.stringify(value, null, 2)
                                        : String(value)}
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        </>
                      )}

                    {/* Events */}
                    {selectedSpan.events && selectedSpan.events.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold">Events</h4>
                          <div className="space-y-3">
                            {selectedSpan.events.map(
                              (
                                event: {
                                  name: string;
                                  timestamp: string;
                                  attributes: Record<string, any>;
                                },
                                idx: number,
                              ) => (
                                <div
                                  key={idx}
                                  className="rounded border bg-muted/50 p-3 text-sm"
                                >
                                  <div className="mb-2 flex items-center justify-between">
                                    <span className="font-medium">
                                      {event.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(
                                        event.timestamp,
                                      ).toLocaleString()}
                                    </span>
                                  </div>
                                  {Object.keys(event.attributes).length > 0 && (
                                    <div className="mt-2 space-y-1 text-xs">
                                      {Object.entries(event.attributes).map(
                                        ([key, value]) => (
                                          <div key={key}>
                                            <span className="text-muted-foreground">
                                              {key}:
                                            </span>{" "}
                                            {typeof value === "object"
                                              ? JSON.stringify(value)
                                              : String(value)}
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  )}
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    <Separator />

                    {/* Metadata */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">Metadata</h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">
                            Created At:
                          </span>
                          <div>{formatTimestamp(selectedSpan.createdAt)}</div>
                        </div>

                        <div>
                          <span className="text-muted-foreground">
                            Workspace ID:
                          </span>
                          <div className="font-mono text-xs">
                            {selectedSpan.workspaceId}
                          </div>
                        </div>

                        <div>
                          <span className="text-muted-foreground">
                            Span DB ID:
                          </span>
                          <div className="font-mono text-xs">
                            {selectedSpan.id}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
