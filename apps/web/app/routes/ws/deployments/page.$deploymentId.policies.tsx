import { Fragment, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

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
import { ResourceIcon } from "~/components/ui/resource-icon";
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
import { getRuleDisplay } from "./_components/environmentversiondecisions/policy-skip/utils";

import type { ReleaseTargetWithState } from "./_components/types";

type PolicyRule = Record<string, unknown> & {
  id: string;
  policyId: string;
  createdAt: string;
};

type ResolvedPolicy = {
  policy: {
    id: string;
    name: string;
    description?: string | null;
    selector: string;
    metadata: Record<string, string>;
    priority: number;
    enabled: boolean;
    workspaceId: string;
    createdAt: string;
    rules: PolicyRule[];
  };
  environmentIds: string[];
  releaseTargets: {
    resourceId: string;
    environmentId: string;
    deploymentId: string;
  }[];
};

type ReleaseTargetRef = {
  resourceId: string;
  environmentId: string;
  deploymentId: string;
};

const releaseTargetKey = (releaseTarget: ReleaseTargetRef) =>
  `${releaseTarget.resourceId}-${releaseTarget.environmentId}-${releaseTarget.deploymentId}`;

const formatSelector = (selector?: string | null) => {
  if (!selector) return "any";
  return selector;
};

const truncateText = (value: string, maxLength = 120) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
};

const getRuleDetails = (rule: PolicyRule): string[] => {
  const r = rule as Record<string, any>;

  if (r.anyApproval != null)
    return [`Min approvals: ${r.anyApproval.minApprovals}`];

  if (r.deploymentDependency != null) {
    return [
      `Depends on: ${truncateText(r.deploymentDependency.dependsOn)}`,
    ];
  }

  if (r.deploymentWindow != null) {
    const details = [
      r.deploymentWindow.allowWindow
        ? "Allow deployments during window"
        : "Block deployments during window",
      `Duration: ${r.deploymentWindow.durationMinutes}m`,
      `RRule: ${truncateText(r.deploymentWindow.rrule, 100)}`,
    ];
    if (r.deploymentWindow.timezone) {
      details.push(`Timezone: ${r.deploymentWindow.timezone}`);
    }
    return details;
  }

  if (r.environmentProgression != null) {
    const details = [
      `Depends on environments: ${truncateText(
        formatSelector(
          r.environmentProgression.dependsOnEnvironmentSelector,
        ),
      )}`,
      `Min success: ${r.environmentProgression.minimumSuccessPercentage}%`,
      `Soak time: ${r.environmentProgression.minimumSoakTimeMinutes}m`,
    ];
    if (r.environmentProgression.maximumAgeHours != null) {
      details.push(`Max age: ${r.environmentProgression.maximumAgeHours}h`);
    }
    if (
      r.environmentProgression.successStatuses != null &&
      r.environmentProgression.successStatuses.length > 0
    ) {
      details.push(
        `Success statuses: ${r.environmentProgression.successStatuses.join(", ")}`,
      );
    }
    return details;
  }

  if (r.gradualRollout != null) {
    return [
      `Strategy: ${r.gradualRollout.rolloutType}`,
      `Interval: ${r.gradualRollout.timeScaleInterval}s`,
    ];
  }

  if (r.retry != null) {
    const details = [
      `Max retries: ${r.retry.maxRetries}`,
      `Backoff: ${r.retry.backoffStrategy}`,
    ];
    if (r.retry.backoffSeconds != null) {
      details.push(`Backoff delay: ${r.retry.backoffSeconds}s`);
    }
    if (r.retry.maxBackoffSeconds != null) {
      details.push(`Max backoff: ${r.retry.maxBackoffSeconds}s`);
    }
    if (r.retry.retryOnStatuses != null) {
      details.push(`Statuses: ${r.retry.retryOnStatuses.join(", ")}`);
    }
    return details;
  }

  if (r.rollback != null) {
    const details = [
      r.rollback.onVerificationFailure
        ? "Rollback on verification failure"
        : "No rollback on verification failure",
    ];
    if (r.rollback.onJobStatuses != null) {
      details.push(`Job statuses: ${r.rollback.onJobStatuses.join(", ")}`);
    }
    return details;
  }

  if (r.verification != null) {
    return [
      `Metrics: ${Array.isArray(r.verification.metrics) ? r.verification.metrics.length : 0}`,
      `Trigger: ${r.verification.triggerOn}`,
    ];
  }

  if (r.versionCooldown != null) {
    return [`Cooldown: ${r.versionCooldown.intervalSeconds}s`];
  }

  if (r.versionSelector != null) {
    return [
      ...(r.versionSelector.description
        ? [r.versionSelector.description]
        : []),
      `Selector: ${truncateText(formatSelector(r.versionSelector.selector))}`,
    ];
  }

  return [];
};

const getPolicySelectorDescription = (selector?: string): string[] => {
  const value = selector?.trim();
  if (!value || value === "true") return [];
  return [value];
};

type PolicyResourceRowProps = {
  releaseTarget: ReleaseTargetWithState;
};

const PolicyResourceRow: React.FC<PolicyResourceRowProps> = ({
  releaseTarget,
}) => {
  const { workspace } = useWorkspace();
  const { resource, environment } = releaseTarget;
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <ResourceIcon kind={resource.kind} version={resource.version} />
          <Link
            to={`/${workspace.slug}/resources/${encodeURIComponent(resource.identifier)}`}
            className="hover:underline"
          >
            {resource.name}
          </Link>
        </div>
      </TableCell>
      <TableCell>
        <Link
          to={`/${workspace.slug}/environments/${environment.id}`}
          className="text-muted-foreground hover:underline"
        >
          {environment.name}
        </Link>
      </TableCell>
    </TableRow>
  );
};

type PolicyReleaseTargetsGroupProps = {
  policy: ResolvedPolicy;
  releaseTargets: ReleaseTargetWithState[];
};

const PolicyReleaseTargetsGroup: React.FC<PolicyReleaseTargetsGroupProps> = ({
  policy,
  releaseTargets,
}) => {
  const [open, setOpen] = useState(true);
  const visibleTargets = open ? releaseTargets : [];
  const ruleSummaries = policy.policy.rules.map((rule) => ({
    id: rule.id,
    name: getRuleDisplay(rule),
    details: getRuleDetails(rule),
  }));
  const selectorSummaries = getPolicySelectorDescription(policy.policy.selector);
  return (
    <Fragment>
      <TableRow>
        <TableCell colSpan={2} className="bg-muted/50">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setOpen(!open)}
              className="size-5 shrink-0"
            >
              <ChevronRight
                className={cn(
                  "size-4 transition-transform",
                  open && "rotate-90",
                )}
              />
            </Button>
            <div className="flex flex-1 items-center gap-3">
              <span className="text-sm font-medium">{policy.policy.name}</span>
              <Badge variant={policy.policy.enabled ? "default" : "secondary"}>
                {policy.policy.enabled ? "Enabled" : "Disabled"}
              </Badge>
              <Badge variant="outline">Priority {policy.policy.priority}</Badge>
              <Badge variant="outline">
                {policy.policy.rules.length} rule
                {policy.policy.rules.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              {releaseTargets.length} resource
              {releaseTargets.length === 1 ? "" : "s"}
            </span>
          </div>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={2} className="bg-muted/30">
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {policy.policy.description ??
                  "No description provided for this policy."}
              </div>
              {selectorSummaries.length > 0 && (
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="text-xs font-medium uppercase tracking-wide text-foreground">
                    Target selector (CEL)
                  </div>
                  {selectorSummaries.map((value, idx) => (
                    <div key={idx}>{value}</div>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-foreground">
                  Rules
                </div>
                {ruleSummaries.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No rules configured for this policy.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {ruleSummaries.map((rule) => (
                      <div key={rule.id} className="space-y-1">
                        <div className="text-sm font-medium">{rule.name}</div>
                        {rule.details.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {rule.details.join(" | ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
      {open && releaseTargets.length === 0 && (
        <TableRow>
          <TableCell colSpan={2} className="text-sm text-muted-foreground">
            No resources match this policy.
          </TableCell>
        </TableRow>
      )}
      {visibleTargets.map((releaseTarget) => (
        <PolicyResourceRow
          key={releaseTargetKey(releaseTarget.releaseTarget)}
          releaseTarget={releaseTarget}
        />
      ))}
    </Fragment>
  );
};

export function meta() {
  return [
    { title: "Policies - Deployment Details - Ctrlplane" },
    { name: "description", content: "View deployment policy assignments" },
  ];
}

const DeploymentPolicies: React.FC = () => {
  const { workspace } = useWorkspace();
  const { deployment } = useDeployment();

  const policiesQuery = trpc.deployment.policies.useQuery({
    workspaceId: workspace.id,
    deploymentId: deployment.id,
  });

  const releaseTargetsQuery = trpc.deployment.releaseTargets.useQuery({
    deploymentId: deployment.id,
    limit: 1000,
    offset: 0,
  });

  const policies = useMemo(() => {
    return [...(policiesQuery.data ?? [])].sort((a, b) =>
      a.policy.name.localeCompare(b.policy.name),
    );
  }, [policiesQuery.data]);

  const releaseTargets = releaseTargetsQuery.data ?? [];

  const releaseTargetsByKey = useMemo(() => {
    return new Map(
      releaseTargets.map((releaseTarget) => [
        releaseTargetKey(releaseTarget.releaseTarget),
        releaseTarget,
      ]),
    );
  }, [releaseTargets]);

  const resolvePolicyTargets = (
    policy: ResolvedPolicy,
  ): ReleaseTargetWithState[] => {
    const resolved = policy.releaseTargets
      .map((releaseTarget) =>
        releaseTargetsByKey.get(releaseTargetKey(releaseTarget)),
      )
      .filter((rt): rt is NonNullable<typeof rt> => rt != null);

    return resolved.sort((a, b) => {
      const environmentComparison = a.environment.name.localeCompare(
        b.environment.name,
      );
      if (environmentComparison !== 0) return environmentComparison;
      return a.resource.name.localeCompare(b.resource.name);
    });
  };

  const isLoading = policiesQuery.isLoading || releaseTargetsQuery.isLoading;

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
              <BreadcrumbPage>Policies</BreadcrumbPage>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <DeploymentsNavbarTabs />
      </header>

      <div className="flex flex-1 flex-col">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center p-6 text-sm text-muted-foreground">
            Loading policies...
          </div>
        ) : policies.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 p-6">
            <div className="text-lg font-medium">
              No policies apply to this deployment
            </div>
            <div className="text-sm text-muted-foreground">
              Assign policies to release targets to see them here.
            </div>
          </div>
        ) : (
          <Table className="border-b">
            <TableHeader>
              <TableRow>
                <TableHead>Resource</TableHead>
                <TableHead>Environment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy) => (
                <PolicyReleaseTargetsGroup
                  key={policy.policy.id}
                  policy={policy}
                  releaseTargets={resolvePolicyTargets(policy)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
};

export default DeploymentPolicies;
