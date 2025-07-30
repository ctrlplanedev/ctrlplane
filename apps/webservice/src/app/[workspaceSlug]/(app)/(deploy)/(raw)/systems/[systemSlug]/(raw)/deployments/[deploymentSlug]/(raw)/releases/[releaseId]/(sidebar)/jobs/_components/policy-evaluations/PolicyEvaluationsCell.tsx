import type { RouterOutputs } from "@ctrlplane/api";
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  IconArrowsSplit,
  IconCalendarTime,
  IconLoader2,
  IconShieldFilled,
} from "@tabler/icons-react";
import { formatDistanceToNowStrict } from "date-fns";
import _ from "lodash";

import { Button } from "@ctrlplane/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import { useEnvironmentVersionApprovalDrawer } from "../rule-drawers/environment-version-approval/useEnvironmentVersionApprovalDrawer";
import { useVersionSelectorDrawer } from "../rule-drawers/version-selector/useVersionSelectorDrawer";
import { BlockingReleaseTargetJobTooltip } from "./BlockingReleaseTargetJobTooltip";
import {
  getBlockingReleaseTargetJob,
  getPoliciesBlockingByApproval,
  getPoliciesBlockingByConcurrency,
  getPoliciesBlockingByVersionSelector,
  getPolicyBlockingByRollout,
} from "./utils";
import { VersionDependencyBadge } from "./VersionDependencyBadge";

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

const VersionSelectorDrawerTrigger: React.FC<{
  releaseTargetId: string;
}> = ({ releaseTargetId }) => {
  const { setReleaseTargetId } = useVersionSelectorDrawer();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setReleaseTargetId(releaseTargetId)}
      className="flex h-6 text-sm text-muted-foreground"
    >
      Blocking version selector
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

  if (policiesBlockingByVersionSelector.length > 0)
    return (
      <div className="flex items-center gap-2">
        <VersionSelectorDrawerTrigger releaseTargetId={releaseTargetId} />
      </div>
    );

  if (blockingVersionDependencies.length > 0)
    return (
      <div className="flex items-center gap-2">
        <VersionDependencyBadge
          resource={resource}
          version={version}
          dependencyResults={blockingVersionDependencies}
        />
      </div>
    );

  if (policiesBlockingByApproval.length > 0)
    return (
      <div className="flex items-center gap-2">
        <ApprovalDrawerTrigger
          versionId={versionId}
          environmentId={environmentId}
        />
      </div>
    );

  if (policiesBlockingByConcurrency.length > 0)
    return (
      <div className="flex items-center gap-2">
        <PolicyListTooltip policies={policiesBlockingByConcurrency}>
          <div className="flex items-center gap-2 rounded-md border border-yellow-500 px-2 py-1 text-xs text-yellow-500">
            <IconArrowsSplit className="h-4 w-4" />
            Blocking concurrency gate
          </div>
        </PolicyListTooltip>
      </div>
    );

  if (policyBlockingByRollout != null)
    return (
      <PolicyListTooltip policies={[policyBlockingByRollout.policy]}>
        <div className="flex items-center gap-2 rounded-md border border-blue-500 px-2 py-1 text-xs text-blue-500">
          <IconCalendarTime className="h-4 w-4" />
          {policyBlockingByRollout.rolloutTime
            ? `Rolls out in ${formatDistanceToNowStrict(policyBlockingByRollout.rolloutTime)}`
            : "Rollout not started"}
        </div>
      </PolicyListTooltip>
    );

  if (blockingReleaseTargetJob != null)
    return (
      <div className="flex items-center gap-2">
        <BlockingReleaseTargetJobTooltip jobInfo={blockingReleaseTargetJob} />
      </div>
    );

  return <div className="text-sm text-muted-foreground">No jobs</div>;
};
