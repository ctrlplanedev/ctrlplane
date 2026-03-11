import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { useMemo } from "react";

import { trpc } from "~/api/trpc";
import { useWorkspace } from "~/components/WorkspaceProvider";

type PolicyRule = WorkspaceEngine["schemas"]["PolicyRule"];

export function usePolicyRulesForVersion(
  versionId: string,
  environmentId: string,
): { policyRules: PolicyRule[]; hasBlockingRules: boolean } {
  const { workspace } = useWorkspace();

  const { data } = trpc.deploymentVersions.evaulate.useQuery(
    { versionId, environmentId },
    { refetchInterval: 5000 },
  );

  const { data: policies } = trpc.policies.list.useQuery(
    { workspaceId: workspace.id },
    { staleTime: 60_000 },
  );

  const hasBlockingRules = (data ?? []).some((d) => !d.allowed);

  const policyRules = useMemo(() => {
    if (policies == null || data == null) return [];
    const ruleIds = new Set(data.map((d) => d.ruleId));

    const rules: PolicyRule[] = [];
    const push = (
      r: { id: string; policyId: string; createdAt: Date },
      extra: Record<string, unknown>,
    ) => {
      if (!ruleIds.has(r.id)) return;
      rules.push({
        id: r.id,
        policyId: r.policyId,
        createdAt: r.createdAt.toISOString(),
        ...extra,
      } as PolicyRule);
    };

    for (const p of policies) {
      for (const r of p.anyApprovalRules)
        push(r, { anyApproval: { minApprovals: r.minApprovals } });
      for (const r of p.deploymentWindowRules)
        push(r, {
          deploymentWindow: {
            allowWindow: r.allowWindow,
            durationMinutes: r.durationMinutes,
            rrule: r.rrule,
            timezone: r.timezone,
          },
        });
      for (const r of p.gradualRolloutRules)
        push(r, {
          gradualRollout: {
            rolloutType: r.rolloutType,
            timeScaleInterval: r.timeScaleInterval,
          },
        });
      for (const r of p.environmentProgressionRules)
        push(r, {
          environmentProgression: {
            dependsOnEnvironmentSelector: r.dependsOnEnvironmentSelector,
            maximumAgeHours: r.maximumAgeHours,
            minimumSoakTimeMinutes: r.minimumSoakTimeMinutes,
            minimumSuccessPercentage: r.minimumSuccessPercentage,
            successStatuses: r.successStatuses,
          },
        });
      for (const r of p.versionCooldownRules)
        push(r, { versionCooldown: { intervalSeconds: r.intervalSeconds } });
      for (const r of p.versionSelectorRules)
        push(r, {
          versionSelector: {
            description: r.description,
            selector: r.selector,
          },
        });
    }

    return rules;
  }, [policies, data]);

  return { policyRules, hasBlockingRules };
}
