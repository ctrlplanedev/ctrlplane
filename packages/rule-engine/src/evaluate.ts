import type * as schema from "@ctrlplane/db/schema";

import type { Releases } from "./releases.js";
import type { DeploymentResourceContext } from "./types.js";
import { RuleEngine } from "./rule-engine.js";
import {
  getRecentDeploymentCount,
  GradualVersionRolloutRule,
} from "./rules/gradual-version-rollout-rule.js";
import { MaintenanceWindowRule } from "./rules/maintenance-window-rule.js";
import { TimeWindowRule } from "./rules/time-window-rule.js";
import { VersionMetadataValidationRule } from "./rules/version-metadata-validation-rule.js";

type Rule = schema.Rule & {
  rollouts?: schema.RuleRollout;
  approvals?: schema.RuleApproval[];
  maintenanceWindows?: schema.RuleMaintenanceWindow[];
  resourceConcurrency?: schema.RuleResourceConcurrency;
  versionMetadataValidation?: schema.RuleVersionMetadataValidation[];
  timeWindows?: schema.RuleTimeWindow[];
};

const maintenanceWindows = (rule: Rule) =>
  new MaintenanceWindowRule(rule.maintenanceWindows ?? []);

const versionMetadataValidation = (rule: Rule) =>
  rule.versionMetadataValidation?.map(
    (v) =>
      new VersionMetadataValidationRule({
        metadataKey: v.metadataKey,
        requiredValue: v.requiredValue,
        allowMissingMetadata: v.allowMissingMetadata,
      }),
  ) ?? [];

const timeWindow = (rule: Rule) =>
  rule.timeWindows?.map(
    (t) =>
      new TimeWindowRule({
        startHour: t.startHour,
        endHour: t.endHour,
        days: t.days,
        timezone: t.timezone,
      }),
  ) ?? [];

const gradualVersionRollout = ({ rollouts }: Rule) =>
  rollouts != null
    ? [new GradualVersionRolloutRule({ ...rollouts, getRecentDeploymentCount })]
    : [];

export const evaluate = (
  rule: Rule,
  releases: Releases,
  context: DeploymentResourceContext,
) => {
  const ruleEngine = new RuleEngine([
    maintenanceWindows(rule),
    ...versionMetadataValidation(rule),
    ...timeWindow(rule),
    ...gradualVersionRollout(rule),
  ]);
  return ruleEngine.evaluate(releases, context);
};
