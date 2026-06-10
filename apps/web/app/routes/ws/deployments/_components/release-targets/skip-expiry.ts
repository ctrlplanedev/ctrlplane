import { addHours } from "date-fns";

export type ExpiryOption = { id: string; label: string; value: Date | null };

export type RuleEvaluation = {
  ruleId: string;
  details: unknown;
  nextEvaluationAt?: Date | string | null;
};

type RuleBasedExpiry = { label: string; value: Date };

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  return isNaN(date.getTime()) ? null : date;
}

function ruleBasedExpiry(
  details: unknown,
  nextEvaluationAt: Date | null,
  now: Date,
): RuleBasedExpiry | null {
  const d = (details ?? {}) as {
    target_rollout_position?: unknown;
    target_rollout_time?: unknown;
    next_window_start?: unknown;
    next_deployment_time?: unknown;
  };

  const isGradualRollout =
    d.target_rollout_position != null || d.target_rollout_time != null;
  if (isGradualRollout) {
    const rolloutTime = toDate(d.target_rollout_time);
    return rolloutTime != null && rolloutTime > now
      ? { label: "Until rollout completes", value: rolloutTime }
      : null;
  }

  const windowOpen = toDate(d.next_window_start);
  if (windowOpen != null && windowOpen > now)
    return { label: "Until deploy window opens", value: windowOpen };

  const cooldownEnd = toDate(d.next_deployment_time);
  if (cooldownEnd != null && cooldownEnd > now)
    return { label: "Until cooldown ends", value: cooldownEnd };

  if (nextEvaluationAt != null && nextEvaluationAt > now)
    return { label: "Until this rule passes", value: nextEvaluationAt };

  return null;
}

// `evaulate` returns evaluations across every resource for the rule with no
// guaranteed ordering, and each resource clears the rule at a different time.
// Take the latest so a single skip covers the whole set.
function latestRuleBasedExpiry(
  evaluations: RuleEvaluation[],
  now: Date,
): RuleBasedExpiry | null {
  let latest: RuleBasedExpiry | null = null;
  for (const evaluation of evaluations) {
    const candidate = ruleBasedExpiry(
      evaluation.details,
      toDate(evaluation.nextEvaluationAt),
      now,
    );
    if (candidate == null) continue;
    if (latest == null || candidate.value > latest.value) latest = candidate;
  }
  return latest;
}

export function expiryOptionsForRule(
  evaluations: RuleEvaluation[],
  ruleId: string | undefined,
  now: Date,
): ExpiryOption[] {
  const ruleBased =
    ruleId == null
      ? null
      : latestRuleBasedExpiry(
          evaluations.filter((evaluation) => evaluation.ruleId === ruleId),
          now,
        );

  const options: ExpiryOption[] = [];
  if (ruleBased != null)
    options.push({ id: "rule", label: ruleBased.label, value: ruleBased.value });
  for (const hours of [6, 12, 24])
    options.push({
      id: `${hours}h`,
      label: `${hours} hours`,
      value: addHours(now, hours),
    });
  options.push({ id: "none", label: "No expiration", value: null });
  return options;
}
