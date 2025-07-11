import type { RouterOutputs } from "@ctrlplane/api";
import React from "react";
import { IconCheck, IconShieldFilled } from "@tabler/icons-react";
import { formatDistanceToNowStrict, isBefore } from "date-fns";

import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { api } from "~/trpc/react";
import {
  Failing,
  Waiting,
} from "../../checks/_components/flow-diagram/StatusIcons";

type PolicyEvaluation = RouterOutputs["policy"]["evaluate"]["releaseTarget"];

const ApprovalCheck: React.FC<{
  policyEvaluations: PolicyEvaluation;
}> = ({ policyEvaluations }) => {
  const isAnyApprovalSatisfied = Object.values(
    policyEvaluations.rules.anyApprovals,
  ).every((reasons) => reasons.length === 0);

  const isUserApprovalSatisfied = Object.values(
    policyEvaluations.rules.userApprovals,
  ).every((reasons) => reasons.length === 0);

  const isRoleApprovalSatisfied = Object.values(
    policyEvaluations.rules.roleApprovals,
  ).every((reasons) => reasons.length === 0);

  const isApproved =
    isAnyApprovalSatisfied &&
    isUserApprovalSatisfied &&
    isRoleApprovalSatisfied;

  if (isApproved)
    return (
      <div className="flex items-center gap-2">
        <IconCheck className="h-4 w-4 text-green-400" /> Approved
      </div>
    );

  return (
    <div className="flex items-center gap-2">
      <Waiting /> Not enough approvals
    </div>
  );
};

const VersionSelectorCheck: React.FC<{
  policyEvaluations: PolicyEvaluation;
}> = ({ policyEvaluations }) => {
  const isPassingVersionSelector = Object.values(
    policyEvaluations.rules.versionSelector,
  ).every((isPassing) => isPassing);

  if (isPassingVersionSelector)
    return (
      <div className="flex items-center gap-2">
        <IconCheck className="h-4 w-4 text-green-400" /> Version selector passed
      </div>
    );

  return (
    <div className="flex items-center gap-2">
      <Failing /> Version selector failed
    </div>
  );
};

const RolloutCheck: React.FC<{
  releaseTargetId: string;
  versionId: string;
}> = ({ releaseTargetId, versionId }) => {
  const { data: policyEvaluations, isLoading } =
    api.policy.evaluate.releaseTarget.useQuery(
      { releaseTargetId, versionId },
      { refetchInterval: 5_000 },
    );

  const rolloutTime = policyEvaluations?.rules.rolloutInfo.rolloutTime;
  const now = new Date();

  if (isLoading)
    return (
      <div className="flex items-center gap-2">
        <Waiting /> Loading rollout information
      </div>
    );

  if (rolloutTime == null)
    return (
      <div className="flex items-center gap-2">
        <Failing /> Rollout not started
      </div>
    );

  const isAfterOrOnRolloutTime = rolloutTime <= now;
  if (isAfterOrOnRolloutTime)
    return (
      <div className="flex items-center gap-2">
        <IconCheck className="h-4 w-4 text-green-400" /> Rollout passed
      </div>
    );

  const timeTillRollout = formatDistanceToNowStrict(rolloutTime, {
    addSuffix: true,
  });

  return (
    <div className="flex items-center gap-2">
      <Waiting /> Job will roll out {timeTillRollout}
    </div>
  );
};

const getIsPassingAllRules = (policyEvaluations?: PolicyEvaluation) => {
  if (policyEvaluations == null) return true;

  const isFailingAnyApprovalRules =
    Object.values(policyEvaluations.rules.anyApprovals).flat().length > 0;
  if (isFailingAnyApprovalRules) return false;

  const isFailingUserApprovalRules =
    Object.values(policyEvaluations.rules.userApprovals).flat().length > 0;
  if (isFailingUserApprovalRules) return false;

  const isFailingRoleApprovalRules =
    Object.values(policyEvaluations.rules.roleApprovals).flat().length > 0;
  if (isFailingRoleApprovalRules) return false;

  const isFailingVersionSelectorRules = Object.values(
    policyEvaluations.rules.versionSelector,
  )
    .flat()
    .some((v) => v === false);
  if (isFailingVersionSelectorRules) return false;

  const now = new Date();
  const { rolloutTime } = policyEvaluations.rules.rolloutInfo;
  const isFailingRolloutRule =
    rolloutTime == null || isBefore(now, rolloutTime);
  if (isFailingRolloutRule) return false;

  return true;
};

const PolicyBlockCell: React.FC = () => (
  <div className="flex w-fit cursor-pointer items-center gap-1">
    <IconShieldFilled className="h-3 w-3 text-muted-foreground" />
    <span className="text-sm">Blocked by policy</span>
  </div>
);

export const PolicyEvaluationTooltip: React.FC<{
  releaseTargetId: string;
  versionId: string;
  children: React.ReactNode;
}> = (props) => {
  const { data: policyEvaluations, isLoading } =
    api.policy.evaluate.releaseTarget.useQuery({
      releaseTargetId: props.releaseTargetId,
      versionId: props.versionId,
    });

  const hasApprovalRules =
    policyEvaluations?.policies.some(
      (p) =>
        p.versionAnyApprovals != null ||
        p.versionUserApprovals.length > 0 ||
        p.versionRoleApprovals.length > 0,
    ) ?? false;
  const hasVersionSelectorRule =
    policyEvaluations?.policies.some(
      (p) => p.deploymentVersionSelector != null,
    ) ?? false;
  const hasRolloutRule =
    policyEvaluations?.policies.some(
      (p) => p.environmentVersionRollout != null,
    ) ?? false;

  const hasRules = hasApprovalRules || hasVersionSelectorRule || hasRolloutRule;
  const isPassingAllRules = getIsPassingAllRules(policyEvaluations);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild onMouseEnter={(e) => e.stopPropagation()}>
          {isPassingAllRules ? props.children : <PolicyBlockCell />}
        </TooltipTrigger>
        <TooltipContent side="right" className="border bg-neutral-950 p-2">
          {isLoading && <Skeleton className="h-4 w-24" />}
          {!isLoading && policyEvaluations != null && (
            <div className="flex flex-col gap-2">
              {hasApprovalRules && (
                <ApprovalCheck policyEvaluations={policyEvaluations} />
              )}
              {hasVersionSelectorRule && (
                <VersionSelectorCheck policyEvaluations={policyEvaluations} />
              )}
              {hasRolloutRule && <RolloutCheck {...props} />}
            </div>
          )}
          {!isLoading && !hasRules && "No policies applied"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
