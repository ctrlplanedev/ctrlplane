import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
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

type ResolvedPolicy = WorkspaceEngine["schemas"]["ResolvedPolicy"];
type ReleaseTarget = WorkspaceEngine["schemas"]["ReleaseTarget"];
type ReleaseTargetWithState =
  WorkspaceEngine["schemas"]["ReleaseTargetWithState"];
type PolicyRule = WorkspaceEngine["schemas"]["PolicyRule"];
type Selector = WorkspaceEngine["schemas"]["Selector"];

const releaseTargetKey = (releaseTarget: ReleaseTarget) =>
  `${releaseTarget.resourceId}-${releaseTarget.environmentId}-${releaseTarget.deploymentId}`;

const formatSelector = (selector?: Selector) => {
  if (!selector) return "any";
  if ("cel" in selector) return selector.cel;
  return JSON.stringify(selector);
};

const truncateText = (value: string, maxLength = 120) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
};

const getRuleDetails = (rule: PolicyRule): string[] => {
  if (rule.anyApproval != null)
    return [`Min approvals: ${rule.anyApproval.minApprovals}`];

  if (rule.deploymentDependency != null) {
    const details = [
      `Depends on deployments: ${truncateText(
        formatSelector(rule.deploymentDependency.dependsOnDeploymentSelector),
      )}`,
    ];
    if (rule.deploymentDependency.reference) {
      details.push(`Reference: ${rule.deploymentDependency.reference}`);
    }
    return details;
  }

  if (rule.deploymentWindow != null) {
    const details = [
      rule.deploymentWindow.allowWindow
        ? "Allow deployments during window"
        : "Block deployments during window",
      `Duration: ${rule.deploymentWindow.durationMinutes}m`,
      `RRule: ${truncateText(rule.deploymentWindow.rrule, 100)}`,
    ];
    if (rule.deploymentWindow.timezone) {
      details.push(`Timezone: ${rule.deploymentWindow.timezone}`);
    }
    return details;
  }

  if (rule.environmentProgression != null) {
    const details = [
      `Depends on environments: ${truncateText(
        formatSelector(
          rule.environmentProgression.dependsOnEnvironmentSelector,
        ),
      )}`,
      `Min success: ${rule.environmentProgression.minimumSuccessPercentage}%`,
      `Soak time: ${rule.environmentProgression.minimumSockTimeMinutes}m`,
    ];
    if (rule.environmentProgression.maximumAgeHours != null) {
      details.push(`Max age: ${rule.environmentProgression.maximumAgeHours}h`);
    }
    if (
      rule.environmentProgression.successStatuses != null &&
      rule.environmentProgression.successStatuses.length > 0
    ) {
      details.push(
        `Success statuses: ${rule.environmentProgression.successStatuses.join(", ")}`,
      );
    }
    return details;
  }

  if (rule.gradualRollout != null) {
    return [
      `Strategy: ${rule.gradualRollout.rolloutType}`,
      `Interval: ${rule.gradualRollout.timeScaleInterval}s`,
    ];
  }

  if (rule.retry != null) {
    const details = [
      `Max retries: ${rule.retry.maxRetries}`,
      `Backoff: ${rule.retry.backoffStrategy}`,
    ];
    if (rule.retry.backoffSeconds != null) {
      details.push(`Backoff delay: ${rule.retry.backoffSeconds}s`);
    }
    if (rule.retry.maxBackoffSeconds != null) {
      details.push(`Max backoff: ${rule.retry.maxBackoffSeconds}s`);
    }
    if (rule.retry.retryOnStatuses != null) {
      details.push(`Statuses: ${rule.retry.retryOnStatuses.join(", ")}`);
    }
    return details;
  }

  if (rule.rollback != null) {
    const details = [
      rule.rollback.onVerificationFailure
        ? "Rollback on verification failure"
        : "No rollback on verification failure",
    ];
    if (rule.rollback.onJobStatuses != null) {
      details.push(`Job statuses: ${rule.rollback.onJobStatuses.join(", ")}`);
    }
    return details;
  }

  if (rule.verification != null) {
    return [
      `Metrics: ${rule.verification.metrics.length}`,
      `Trigger: ${rule.verification.triggerOn}`,
    ];
  }

  if (rule.versionCooldown != null) {
    return [`Cooldown: ${rule.versionCooldown.intervalSeconds}s`];
  }

  if (rule.versionSelector != null) {
    return [
      ...(rule.versionSelector.description
        ? [rule.versionSelector.description]
        : []),
      `Selector: ${truncateText(formatSelector(rule.versionSelector.selector))}`,
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
    workspaceId: workspace.id,
    deploymentId: deployment.id,
    limit: 1000,
    offset: 0,
  });

  const policies = useMemo(() => {
    return [...(policiesQuery.data ?? [])].sort((a, b) =>
      a.policy.name.localeCompare(b.policy.name),
    );
  }, [policiesQuery.data]);

  const releaseTargets = releaseTargetsQuery.data?.items ?? [];

  const releaseTargetsByKey = useMemo(() => {
    return new Map(
      releaseTargets.map((releaseTarget) => [
        releaseTargetKey(releaseTarget.releaseTarget),
        releaseTarget,
      ]),
    );
  }, [releaseTargets]);

  const resolvePolicyTargets = (policy: ResolvedPolicy) => {
    return policy.releaseTargets
      .map((releaseTarget) =>
        releaseTargetsByKey.get(releaseTargetKey(releaseTarget)),
      )
      .filter(
        (releaseTarget): releaseTarget is ReleaseTargetWithState =>
          releaseTarget != null,
      )
      .sort((a, b) => {
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
