import type { RouterOutputs } from "@ctrlplane/api";
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  IconArrowsSplit,
  IconCalendarTime,
  IconClock,
  IconExternalLink,
  IconFilterX,
  IconLoader2,
  IconShieldFilled,
} from "@tabler/icons-react";
import { formatDistanceToNowStrict, isAfter } from "date-fns";
import _ from "lodash";

import { cn } from "@ctrlplane/ui";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import { VersionDependencyBadge } from "./policy-evaluations/VersionDependencyBadge";
import { useEnvironmentVersionApprovalDrawer } from "./rule-drawers/environment-version-approval/useEnvironmentVersionApprovalDrawer";

type PolicyEvaluation = RouterOutputs["policy"]["evaluate"]["releaseTarget"];

const PolicyListTooltip: React.FC<{
  policies: { id: string; name: string }[];
  children: React.ReactNode;
}> = ({ policies, children }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const getPolicyUrl = (policyId: string) =>
    urls.workspace(workspaceSlug).policies().byId(policyId);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="flex max-w-80 flex-col gap-2 border bg-neutral-950 p-2">
          {policies.map((policy) => (
            <Link
              key={policy.id}
              href={getPolicyUrl(policy.id)}
              target="_blank"
              rel="noreferrer noopener"
              className="hover:underline"
            >
              {policy.name}
            </Link>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const getPoliciesBlockingByApproval = (
  policyEvaluations?: PolicyEvaluation,
) => {
  if (policyEvaluations == null) return [];
  const policiesBlockingAnyApproval = Object.entries(
    policyEvaluations.rules.anyApprovals,
  )
    .filter(([_, reasons]) => reasons.length > 0)
    .map(([policyId, _]) => policyId);
  const policiesBlockingUserApproval = Object.entries(
    policyEvaluations.rules.userApprovals,
  )
    .filter(([_, reasons]) => reasons.length > 0)
    .map(([policyId, _]) => policyId);
  const policiesBlockingRoleApproval = Object.entries(
    policyEvaluations.rules.roleApprovals,
  )
    .filter(([_, reasons]) => reasons.length > 0)
    .map(([policyId, _]) => policyId);

  const policiesBlockingApproval = _.uniq([
    ...policiesBlockingAnyApproval,
    ...policiesBlockingUserApproval,
    ...policiesBlockingRoleApproval,
  ]);

  return policyEvaluations.policies.filter((p) =>
    policiesBlockingApproval.includes(p.id),
  );
};

const getPoliciesBlockingByVersionSelector = (
  policyEvaluations?: PolicyEvaluation,
) => {
  if (policyEvaluations == null) return [];
  const policiesWithVersionSelectorReasons = Object.entries(
    policyEvaluations.rules.versionSelector,
  )
    .filter(([_, passing]) => !passing)
    .map(([policyId, _]) => policyId);

  return policyEvaluations.policies.filter((p) =>
    policiesWithVersionSelectorReasons.includes(p.id),
  );
};

const getPolicyBlockingByRollout = (policyEvaluations?: PolicyEvaluation) => {
  if (policyEvaluations == null) return null;
  const { rolloutInfo } = policyEvaluations.rules;
  if (rolloutInfo == null) return null;

  const { rolloutTime, policyId } = rolloutInfo;
  const policy = policyEvaluations.policies.find((p) => p.id === policyId);
  if (policy == null) return null;

  if (rolloutTime == null) return { policy, rolloutTime: null };

  const now = new Date();
  if (isAfter(now, rolloutTime)) return null;

  return { policy, rolloutTime };
};

const getPoliciesBlockingByConcurrency = (
  policyEvaluations?: PolicyEvaluation,
) => {
  if (policyEvaluations == null) return [];
  const { concurrencyBlocked } = policyEvaluations.rules;

  const policiesBlockingByConcurrency = Object.entries(concurrencyBlocked)
    .filter(([_, reasons]) => reasons.length > 0)
    .map(([policyId, _]) => policyId);

  return policyEvaluations.policies.filter((p) =>
    policiesBlockingByConcurrency.includes(p.id),
  );
};

const getBlockingReleaseTargetJob = (policyEvaluations?: PolicyEvaluation) => {
  if (policyEvaluations == null) return null;
  const { releaseTargetConcurrencyBlocked } = policyEvaluations.rules;
  if (releaseTargetConcurrencyBlocked.jobInfo != null)
    return releaseTargetConcurrencyBlocked.jobInfo;
  return null;
};

const BlockingReleaseTargetJobTooltip: React.FC<{
  jobInfo: NonNullable<
    PolicyEvaluation["rules"]["releaseTargetConcurrencyBlocked"]["jobInfo"]
  >;
}> = ({ jobInfo }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const versionUrl = urls
    .workspace(workspaceSlug)
    .system(jobInfo.system.slug)
    .deployment(jobInfo.deployment.slug)
    .release(jobInfo.version.id)
    .jobs();

  const linksMetadata = jobInfo.job.metadata[ReservedMetadataKey.Links] ?? "{}";
  const links = JSON.parse(linksMetadata) as Record<string, string>;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 rounded-md border border-neutral-500 px-2 py-1 text-xs text-neutral-500">
            <IconClock className="h-4 w-4" />
            Another job is running
          </div>
        </TooltipTrigger>
        <TooltipContent className="flex w-96 flex-col gap-2 border bg-neutral-950 p-2">
          <div className="flex w-full items-center justify-between truncate">
            <span className="flex-shrink-0">Version:</span>
            <Link
              href={versionUrl}
              className="hover:underline"
              target="_blank"
              rel="noreferrer noopener"
            >
              {jobInfo.version.name}
            </Link>
          </div>
          <div className="flex w-full items-center justify-between truncate">
            <span className="flex-shrink-0">Job:</span>
            <div className="flex items-center gap-1">
              {Object.entries(links).map(([key, value]) => (
                <Link
                  key={key}
                  href={value}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "flex h-6 items-center gap-1",
                  )}
                >
                  <IconExternalLink className="h-3 w-3" />
                  {key}
                </Link>
              ))}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ApprovalDrawerTrigger: React.FC<{
  versionId: string;
  environmentId: string;
}> = ({ versionId, environmentId }) => {
  const { setEnvironmentVersionIds } = useEnvironmentVersionApprovalDrawer();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setEnvironmentVersionIds(environmentId, versionId)}
      className="flex h-6 items-center gap-1 text-xs text-muted-foreground"
    >
      <IconShieldFilled className="h-3 w-3" />
      Blocking approval
    </Button>
  );
};

const getBlockingVersionDependencies = (
  policyEvaluations?: PolicyEvaluation,
) => {
  if (policyEvaluations == null) return [];
  const { versionDependency } = policyEvaluations.rules;
  return versionDependency.filter((v) => !v.isSatisfied);
};

export const PolicyEvaluationsCell: React.FC<{
  resource: { id: string; name: string };
  environmentId: string;
  releaseTargetId: string;
  version: { id: string; tag: string };
}> = ({ resource, releaseTargetId, version, environmentId }) => {
  const versionId = version.id;
  const { data: policyEvaluations, isLoading } =
    api.policy.evaluate.releaseTarget.useQuery({
      releaseTargetId,
      versionId,
    });

  if (isLoading)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <IconLoader2 className="h-4 w-4 animate-spin" />
        Loading policy evaluation...
      </div>
    );

  const policiesBlockingByApproval =
    getPoliciesBlockingByApproval(policyEvaluations);
  const policiesBlockingByVersionSelector =
    getPoliciesBlockingByVersionSelector(policyEvaluations);
  const policyBlockingByRollout = getPolicyBlockingByRollout(policyEvaluations);
  const policiesBlockingByConcurrency =
    getPoliciesBlockingByConcurrency(policyEvaluations);
  const blockingReleaseTargetJob =
    getBlockingReleaseTargetJob(policyEvaluations);
  const blockingVersionDependencies =
    getBlockingVersionDependencies(policyEvaluations);

  const isBlocked =
    policiesBlockingByApproval.length > 0 ||
    policiesBlockingByVersionSelector.length > 0 ||
    policyBlockingByRollout != null ||
    policiesBlockingByConcurrency.length > 0 ||
    blockingReleaseTargetJob != null ||
    blockingVersionDependencies.length > 0;

  if (!isBlocked)
    return <div className="text-sm text-muted-foreground">No jobs</div>;

  return (
    <div className="flex items-center gap-2">
      {policiesBlockingByApproval.length > 0 && (
        <ApprovalDrawerTrigger
          versionId={versionId}
          environmentId={environmentId}
        />
      )}

      {policiesBlockingByVersionSelector.length > 0 && (
        <PolicyListTooltip policies={policiesBlockingByVersionSelector}>
          <div className="flex items-center gap-2 rounded-md border border-purple-500 px-2 py-1 text-xs text-purple-500">
            <IconFilterX className="h-4 w-4" />
            Blocking version selector
          </div>
        </PolicyListTooltip>
      )}

      {policiesBlockingByConcurrency.length > 0 && (
        <PolicyListTooltip policies={policiesBlockingByConcurrency}>
          <div className="flex items-center gap-2 rounded-md border border-yellow-500 px-2 py-1 text-xs text-yellow-500">
            <IconArrowsSplit className="h-4 w-4" />
            Blocking concurrency gate
          </div>
        </PolicyListTooltip>
      )}

      {policyBlockingByRollout != null && (
        <PolicyListTooltip policies={[policyBlockingByRollout.policy]}>
          <div className="flex items-center gap-2 rounded-md border border-blue-500 px-2 py-1 text-xs text-blue-500">
            <IconCalendarTime className="h-4 w-4" />
            {policyBlockingByRollout.rolloutTime
              ? `Rolls out in ${formatDistanceToNowStrict(policyBlockingByRollout.rolloutTime)}`
              : "Rollout not started"}
          </div>
        </PolicyListTooltip>
      )}

      {blockingVersionDependencies.length > 0 && (
        <VersionDependencyBadge
          resource={resource}
          version={version}
          dependencyResults={blockingVersionDependencies}
        />
      )}

      {blockingReleaseTargetJob != null && (
        <BlockingReleaseTargetJobTooltip jobInfo={blockingReleaseTargetJob} />
      )}
    </div>
  );
};
