import type { RouterOutputs } from "@ctrlplane/api";
import React from "react";
import { IconCheck } from "@tabler/icons-react";
import { formatDistanceToNowStrict } from "date-fns";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrlplane/ui/hover-card";

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

export const PolicyEvaluationHover: React.FC<{
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

  if (!hasRules) return <span className="text-sm">No jobs</span>;

  return (
    <HoverCard>
      <HoverCardTrigger asChild onMouseEnter={(e) => e.stopPropagation()}>
        {props.children}
      </HoverCardTrigger>
      <HoverCardContent side="right" className="p-2">
        {isLoading && <div>Loading...</div>}
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
      </HoverCardContent>
    </HoverCard>
  );
};
