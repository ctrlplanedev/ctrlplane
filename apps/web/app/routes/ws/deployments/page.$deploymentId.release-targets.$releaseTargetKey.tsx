import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import _ from "lodash";
import {
  AlertCircleIcon,
  ArrowLeft,
  CalendarClock,
  Check,
  Clock,
  RefreshCw,
  ShieldCheck,
  Timer,
  UserCheck,
  X,
} from "lucide-react";
import { Link, useParams } from "react-router";

import { trpc } from "~/api/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "~/components/ui/hover-card";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Spinner } from "~/components/ui/spinner";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useDeployment } from "./_components/DeploymentProvider";
import { DeploymentsNavbarTabs } from "./_components/DeploymentsNavbarTabs";

function parseReleaseTargetKey(key: string) {
  if (key.length !== 110) return null;
  const resourceId = key.substring(0, 36);
  const environmentId = key.substring(37, 73);
  const deploymentId = key.substring(74, 110);
  return { resourceId, environmentId, deploymentId };
}

type Evaluation = {
  id: string;
  ruleId: string;
  environmentId: string;
  versionId: string;
  resourceId: string;
  allowed: boolean;
  actionRequired: boolean;
  actionType: string | null;
  message: string;
  details: unknown;
  satisfiedAt: Date | null;
  nextEvaluationAt: Date | null;
  evaluatedAt: Date;
};

type VersionInfo = {
  id: string;
  name: string;
  tag: string;
  createdAt: Date;
  status: string;
};

type PolicyInfo = {
  id: string;
  name: string;
};

type EvalResultRow = {
  evaluation: Evaluation;
  version: VersionInfo;
  policy: PolicyInfo | null;
};

function StatusIcon({ evaluation }: { evaluation: Evaluation }) {
  if (evaluation.allowed)
    return <Check className="size-4 shrink-0 text-green-500" />;
  if (evaluation.actionRequired)
    return <AlertCircleIcon className="size-4 shrink-0 text-amber-500" />;
  return <X className="size-4 shrink-0 text-red-500" />;
}

function StatusBadge({ evaluation }: { evaluation: Evaluation }) {
  if (evaluation.allowed)
    return (
      <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">
        Allowed
      </Badge>
    );
  if (evaluation.actionRequired)
    return (
      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
        {evaluation.actionType === "approval"
          ? "Approval Required"
          : "Action Required"}
      </Badge>
    );
  return (
    <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">
      Denied
    </Badge>
  );
}

type WindowDetails = {
  rrule: string;
  timezone: string;
  window_type: string;
  current_time: string;
  next_window_end: string;
  duration_minutes: number;
  next_window_start: string;
  time_until_window: string;
};

function isWindowDetails(details: unknown): details is WindowDetails {
  if (details == null || typeof details !== "object") return false;
  const d = details as Record<string, unknown>;
  return (
    typeof d.window_type === "string" &&
    typeof d.next_window_start === "string" &&
    typeof d.time_until_window === "string"
  );
}

function WindowInfo({ details }: { details: WindowDetails }) {
  const nextStart = new Date(details.next_window_start);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Timer className="size-3" />
        Opens in {details.time_until_window}
      </span>
      <span className="flex items-center gap-1">
        <CalendarClock className="size-3" />
        {nextStart.toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </span>
      <span>
        Window: {details.duration_minutes}m &middot;{" "}
        {details.window_type === "allow" ? "Allow" : "Deny"}
      </span>
    </div>
  );
}

type ApprovalDetails = {
  approvers: string[];
  min_approvals: number;
  version_id: string;
  environment_id: string;
};

function isApprovalDetails(details: unknown): details is ApprovalDetails {
  if (details == null || typeof details !== "object") return false;
  const d = details as Record<string, unknown>;
  return Array.isArray(d.approvers) && typeof d.min_approvals === "number";
}

function ApproverAvatar({ userId }: { userId: string }) {
  const { workspace } = useWorkspace();
  const { data: members } = trpc.workspace.members.useQuery(
    { workspaceId: workspace.id },
    { staleTime: 60_000 },
  );
  const member = members?.find((m) => m.user.id === userId);
  if (member == null)
    return (
      <span className="font-mono text-xs text-muted-foreground">
        {userId.slice(0, 8)}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1">
      <Avatar className="size-4">
        <AvatarImage
          src={member.user.image ?? undefined}
          referrerPolicy="no-referrer"
        />
        <AvatarFallback className="text-[8px]">
          {member.user.name?.charAt(0) ?? "?"}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs">{member.user.name ?? member.user.email}</span>
    </span>
  );
}

function ApprovalInfo({ details }: { details: ApprovalDetails }) {
  const approvedCount = details.approvers.length;
  return (
    <div className="space-y-1.5 text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <ShieldCheck className="size-3" />
        <span>
          {approvedCount} / {details.min_approvals} approval
          {details.min_approvals !== 1 ? "s" : ""}
        </span>
      </div>
      {approvedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 pl-4">
          <UserCheck className="size-3 text-green-500" />
          {details.approvers.map((id) => (
            <ApproverAvatar key={id} userId={id} />
          ))}
        </div>
      )}
    </div>
  );
}

function EvalRow({ evaluation }: { evaluation: Evaluation }) {
  const windowDetails = isWindowDetails(evaluation.details)
    ? evaluation.details
    : null;
  const approvalDetails = isApprovalDetails(evaluation.details)
    ? evaluation.details
    : null;
  const hasSpecialDetails = windowDetails != null || approvalDetails != null;

  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <StatusIcon evaluation={evaluation} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{evaluation.message}</span>
          <StatusBadge evaluation={evaluation} />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            Evaluated{" "}
            {formatDistanceToNow(new Date(evaluation.evaluatedAt), {
              addSuffix: true,
            })}
          </span>
          {evaluation.satisfiedAt != null && (
            <span>
              Satisfied{" "}
              {formatDistanceToNow(new Date(evaluation.satisfiedAt), {
                addSuffix: true,
              })}
            </span>
          )}
        </div>
        {windowDetails != null && <WindowInfo details={windowDetails} />}
        {approvalDetails != null && <ApprovalInfo details={approvalDetails} />}
        {evaluation.details != null &&
          typeof evaluation.details === "object" &&
          !hasSpecialDetails &&
          Object.keys(evaluation.details as Record<string, unknown>).length >
            0 && (
            <HoverCard>
              <HoverCardTrigger asChild>
                <button className="text-xs text-muted-foreground underline decoration-dotted">
                  View details
                </button>
              </HoverCardTrigger>
              <HoverCardContent className="max-h-96 w-96 overflow-auto">
                <pre className="text-xs">
                  {JSON.stringify(evaluation.details, null, 2)}
                </pre>
              </HoverCardContent>
            </HoverCard>
          )}
      </div>
    </div>
  );
}

type EvalWithPolicy = {
  evaluation: Evaluation;
  policy: PolicyInfo | null;
};

function PolicyGroup({
  policy,
  items,
}: {
  policy: PolicyInfo;
  items: Evaluation[];
}) {
  const { workspace } = useWorkspace();
  const allPassing = items.every((e) => e.allowed);
  const hasBlocking = items.some((e) => !e.allowed);

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="mb-4 flex items-center gap-2">
        <Link
          to={`/${workspace.slug}/policies`}
          className="text-sm font-medium hover:underline"
        >
          {policy.name}
        </Link>
        {allPassing && (
          <Badge className="bg-green-500/10 text-xs text-green-600 dark:text-green-400">
            Passing
          </Badge>
        )}
        {hasBlocking && (
          <Badge className="bg-red-500/10 text-xs text-red-600 dark:text-red-400">
            Blocking
          </Badge>
        )}
      </div>
      <div className="space-y-2">
        {items
          .sort((a, b) => a.ruleId.localeCompare(b.ruleId))
          .map((evaluation) => (
            <EvalRow key={evaluation.id} evaluation={evaluation} />
          ))}
      </div>
    </div>
  );
}

function VersionGroup({
  version,
  items,
}: {
  version: VersionInfo;
  items: EvalWithPolicy[];
}) {
  const allPassing = items.every((e) => e.evaluation.allowed);
  const hasBlocking = items.some((e) => !e.evaluation.allowed);
  const versionLabel = version.name || version.tag;

  const policyGroups = useMemo(() => {
    const grouped = _.groupBy(items, (item) => item.policy?.id ?? "unknown");
    return Object.entries(grouped)
      .map(([policyId, group]) => ({
        policyId,
        policy: group[0].policy,
        evaluations: group.map((g) => g.evaluation),
      }))
      .sort((a, b) =>
        (a.policy?.name ?? "").localeCompare(b.policy?.name ?? ""),
      );
  }, [items]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="font-mono text-sm font-medium">{versionLabel}</h3>
        {allPassing && (
          <Badge className="bg-green-500/10 text-xs text-green-600 dark:text-green-400">
            Deployable
          </Badge>
        )}
        {hasBlocking && (
          <Badge className="bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400">
            Blocked
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          Created{" "}
          {new Date(version.createdAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </div>
      <div className="space-y-4">
        {policyGroups.map(({ policyId, policy, evaluations }) =>
          policy != null ? (
            <PolicyGroup key={policyId} policy={policy} items={evaluations} />
          ) : (
            <div key={policyId} className="space-y-2">
              {evaluations.map((evaluation) => (
                <EvalRow key={evaluation.id} evaluation={evaluation} />
              ))}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

export default function ReleaseTargetEvaluationsPage() {
  const { workspace } = useWorkspace();
  const { deployment } = useDeployment();
  const { releaseTargetKey, deploymentId } = useParams();

  const parsed = useMemo(
    () => (releaseTargetKey ? parseReleaseTargetKey(releaseTargetKey) : null),
    [releaseTargetKey],
  );

  const evaluationsQuery = trpc.releaseTargets.evaluations.useQuery(
    {
      environmentId: parsed?.environmentId ?? "",
      resourceId: parsed?.resourceId ?? "",
      deploymentId: deploymentId ?? "",
    },
    {
      enabled: parsed != null && deploymentId != null,
      refetchInterval: 15_000,
    },
  );

  const releaseTargetsQuery = trpc.deployment.releaseTargets.useQuery({
    workspaceId: workspace.id,
    deploymentId: deployment.id,
    limit: 1000,
    offset: 0,
  });

  const releaseTarget = useMemo(() => {
    return releaseTargetsQuery.data?.items.find(
      (rt) =>
        rt.releaseTarget.resourceId === parsed?.resourceId &&
        rt.releaseTarget.environmentId === parsed.environmentId,
    );
  }, [releaseTargetsQuery.data, parsed]);

  const rows = useMemo(
    () => (evaluationsQuery.data ?? []) as EvalResultRow[],
    [evaluationsQuery.data],
  );

  const versionGroups = useMemo(() => {
    const grouped = _.groupBy(rows, (r) => r.version.id);
    return Object.entries(grouped)
      .map(([versionId, items]) => ({
        versionId,
        version: items[0].version,
        items: items.map((r) => ({
          evaluation: r.evaluation,
          policy: r.policy,
        })),
      }))
      .sort(
        (a, b) =>
          new Date(b.version.createdAt).getTime() -
          new Date(a.version.createdAt).getTime(),
      );
  }, [rows]);

  const latestItems = versionGroups[0]?.items ?? [];

  const utils = trpc.useUtils();
  const triggerReconcile = trpc.reconcile.triggerDesiredRelease.useMutation({
    onSuccess: () => {
      utils.releaseTargets.evaluations.invalidate();
    },
  });

  const resourceName =
    releaseTarget?.resource.name ?? parsed?.resourceId ?? "Unknown";
  const environmentName = releaseTarget?.environment.name ?? "Unknown";

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
                  to={`/${workspace.slug}/deployments/${deployment.id}/release-targets`}
                >
                  Targets
                </Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbPage>{resourceName}</BreadcrumbPage>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <DeploymentsNavbarTabs />
      </header>

      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="size-8" asChild>
            <Link
              to={`/${workspace.slug}/deployments/${deployment.id}/release-targets`}
            >
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{resourceName}</h1>
            <p className="text-sm text-muted-foreground">
              Policy evaluations for {environmentName} &middot;{" "}
              {versionGroups.length} version
              {versionGroups.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={parsed == null || triggerReconcile.isPending}
            onClick={() => {
              if (parsed == null) return;
              triggerReconcile.mutate({
                workspaceId: workspace.id,
                deploymentId: parsed.deploymentId,
                environmentId: parsed.environmentId,
                resourceId: parsed.resourceId,
              });
            }}
          >
            <RefreshCw
              className={`mr-2 size-3.5 ${triggerReconcile.isPending ? "animate-spin" : ""}`}
            />
            Reconcile
          </Button>
        </div>

        {evaluationsQuery.isLoading && (
          <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Loading evaluations...
          </div>
        )}

        {rows.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No policy evaluations found for this release target.
          </div>
        )}

        {rows.length > 0 && (
          <div className="space-y-6">
            {versionGroups.map(({ versionId, version, items }, idx) => (
              <div key={versionId}>
                {idx === 0 && latestItems.length > 0 && (
                  <div className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Latest Version
                  </div>
                )}
                {idx === 1 && (
                  <div className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    History
                  </div>
                )}
                <VersionGroup version={version} items={items} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
