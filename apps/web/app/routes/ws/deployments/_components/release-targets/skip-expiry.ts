import { addHours } from "date-fns";

export type ExpiryOption = { id: string; label: string; value: Date | null };

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

export function isGradualRolloutDetails(details: unknown): boolean {
  if (details == null || typeof details !== "object") return false;
  return (
    "target_rollout_position" in details || "target_rollout_time" in details
  );
}

export function maxRolloutTime(
  evaluations: { ruleId: string; details: unknown }[],
  ruleId: string,
): Date | null {
  let latest: Date | null = null;
  for (const evaluation of evaluations) {
    if (evaluation.ruleId !== ruleId) continue;
    const details = evaluation.details as { target_rollout_time?: unknown };
    const time = parseDate(details.target_rollout_time);
    if (time == null) continue;
    if (latest == null || time > latest) latest = time;
  }
  return latest;
}

function ruleBasedOption(
  details: unknown,
  nextEvaluationAt: Date | null,
  gradualMaxTime: Date | null,
  now: Date,
): { label: string; value: Date } | null {
  if (isGradualRolloutDetails(details))
    return gradualMaxTime != null && gradualMaxTime > now
      ? { label: "Until rollout completes", value: gradualMaxTime }
      : null;

  const d = (details ?? {}) as {
    next_window_start?: unknown;
    next_deployment_time?: unknown;
  };

  const windowOpen = parseDate(d.next_window_start);
  if (windowOpen != null && windowOpen > now)
    return { label: "Until deploy window opens", value: windowOpen };

  const cooldownEnd = parseDate(d.next_deployment_time);
  if (cooldownEnd != null && cooldownEnd > now)
    return { label: "Until cooldown ends", value: cooldownEnd };

  if (nextEvaluationAt != null && nextEvaluationAt > now)
    return { label: "Until this rule passes", value: nextEvaluationAt };

  return null;
}

export function buildExpiryOptions(args: {
  details: unknown;
  nextEvaluationAt: Date | null;
  gradualMaxTime: Date | null;
  now: Date;
}): ExpiryOption[] {
  const { details, nextEvaluationAt, gradualMaxTime, now } = args;
  const ruleBased = ruleBasedOption(
    details,
    nextEvaluationAt,
    gradualMaxTime,
    now,
  );

  const options: ExpiryOption[] = [];
  if (ruleBased != null)
    options.push({
      id: "rule",
      label: ruleBased.label,
      value: ruleBased.value,
    });
  for (const hours of [6, 12, 24])
    options.push({
      id: `${hours}h`,
      label: `${hours} hours`,
      value: addHours(now, hours),
    });
  options.push({ id: "none", label: "No expiration", value: null });
  return options;
}

export type RuleEvaluation = {
  ruleId: string;
  details: unknown;
  nextEvaluationAt?: Date | string | null;
};

export function expiryOptionsForRule(
  evaluations: RuleEvaluation[],
  ruleId: string | undefined,
  now: Date,
): ExpiryOption[] {
  const ruleEvaluations = evaluations.filter((e) => e.ruleId === ruleId);
  const first = ruleEvaluations[0];
  return buildExpiryOptions({
    details: first.details ?? null,
    nextEvaluationAt:
      first.nextEvaluationAt != null ? new Date(first.nextEvaluationAt) : null,
    gradualMaxTime:
      ruleId != null ? maxRolloutTime(ruleEvaluations, ruleId) : null,
    now,
  });
}
