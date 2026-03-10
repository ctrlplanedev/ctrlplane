import type { AppRouter } from "@ctrlplane/trpc";
import { useMemo } from "react";
import { formatDistanceToNowStrict, isFuture } from "date-fns";
import _ from "lodash";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  Loader2Icon,
} from "lucide-react";

import { trpc } from "~/api/trpc";
import { Progress } from "~/components/ui/progress";
import { useWorkspace } from "~/components/WorkspaceProvider";

type RolloutEvaluation = NonNullable<
  Awaited<ReturnType<AppRouter["deploymentVersions"]["evaulate"]>>
>[number];

export type GradRolloutDetailProps = {
  rules: RolloutEvaluation[];
};

type RolloutDetails = {
  target_rollout_time?: string;
};

function usePolicyNameByRuleId(): Map<string, string> {
  const { workspace } = useWorkspace();
  const { data: policies } = trpc.policies.list.useQuery(
    { workspaceId: workspace.id },
    { staleTime: 60_000 },
  );

  return useMemo(() => {
    const map = new Map<string, string>();
    if (policies == null) return map;
    for (const policy of policies) {
      for (const rule of policy.gradualRolloutRules) {
        map.set(rule.id, policy.name);
      }
    }
    return map;
  }, [policies]);
}

function getEstimatedCompletion(rules: RolloutEvaluation[]): Date | null {
  let latest: Date | null = null;
  for (const rule of rules) {
    const details = rule.details as Partial<RolloutDetails>;
    if (details.target_rollout_time == null) continue;
    const date = new Date(details.target_rollout_time);
    if (isNaN(date.getTime())) continue;
    if (latest == null || date > latest) latest = date;
  }
  return latest;
}

function StatusIcon({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  if (completed === total && total > 0)
    return <CheckCircle2Icon className="size-3 text-green-500" />;
  if (completed > 0)
    return <Loader2Icon className="size-3 animate-spin text-blue-500" />;
  return <CircleAlertIcon className="size-3 text-amber-500" />;
}

function RolloutRow({
  rules,
  policyName,
}: {
  rules: RolloutEvaluation[];
  policyName: string | undefined;
}) {
  const total = rules.length;
  const completed = rules.filter((rule) => rule.allowed).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isComplete = completed === total && total > 0;

  const label = policyName ?? "Gradual Rollout";
  const estimatedCompletion = getEstimatedCompletion(rules);

  return (
    <div className="flex w-full items-center gap-2">
      <div className="flex grow items-center gap-2">
        <StatusIcon completed={completed} total={total} />
        <span>
          {label} ({completed}/{total})
        </span>
        {!isComplete && <Progress value={percent} className="h-1.5 w-24" />}
      </div>
      {!isComplete && estimatedCompletion != null && isFuture(estimatedCompletion) && (
        <span className="shrink-0 text-muted-foreground">
          in {formatDistanceToNowStrict(estimatedCompletion)}
        </span>
      )}
      {isComplete && (
        <span className="shrink-0 text-muted-foreground">{percent}%</span>
      )}
    </div>
  );
}

export const GradRolloutDetail: React.FC<GradRolloutDetailProps> = ({
  rules,
}) => {
  const policyNameByRuleId = usePolicyNameByRuleId();
  if (rules.length === 0) return null;

  const groupedRules = _.groupBy(rules, (rule) => rule.ruleId);
  return (
    <>
      {Object.entries(groupedRules).map(([ruleId, ruleGroup]) => (
        <RolloutRow
          key={ruleId}
          rules={ruleGroup}
          policyName={policyNameByRuleId.get(ruleId)}
        />
      ))}
    </>
  );
};
