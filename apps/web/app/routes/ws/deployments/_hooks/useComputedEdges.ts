import type { Edge } from "reactflow";
import { useMemo } from "react";
import { evaluate } from "cel-js";

interface PolicyRule {
  [key: string]: unknown;
  environmentProgression?: {
    dependsOnEnvironmentSelector: string;
  };
}

interface Policy {
  policy: {
    enabled: boolean;
    rules: PolicyRule[];
  };
  releaseTargets: { environmentId: string }[];
}

interface Environment {
  id: string;
  name: string;
  metadata: Record<string, string>;
}

interface UseComputedEdgesOptions {
  environments: Environment[];
  policies: Policy[];
}

function matchesEnvironment(celExpr: string, env: Environment): boolean {
  try {
    const result = evaluate(celExpr, {
      environment: {
        id: env.id,
        name: env.name,
        metadata: env.metadata,
      },
    });
    return result === true;
  } catch {
    return false;
  }
}

/**
 * For each policy with environment progression rules, resolves which
 * environments the policy's targets depend on by evaluating the
 * `dependsOnEnvironmentSelector` CEL expression against all environments.
 *
 * Returns a map of targetEnvironmentId -> dependencyEnvironmentIds[]
 */
function resolveEnvironmentDependencies(
  policies: Policy[],
  environments: Environment[],
): Map<string, string[]> {
  const deps = new Map<string, string[]>();

  for (const { policy, releaseTargets } of policies) {
    if (!policy.enabled) continue;

    const progressionRules = policy.rules.filter(
      (
        r,
      ): r is PolicyRule &
        Required<Pick<PolicyRule, "environmentProgression">> =>
        r.environmentProgression != null,
    );
    if (progressionRules.length === 0) continue;

    const targetEnvIds = [
      ...new Set(releaseTargets.map((rt) => rt.environmentId)),
    ];

    for (const rule of progressionRules) {
      const celExpr = rule.environmentProgression.dependsOnEnvironmentSelector;

      const dependencyEnvIds = environments
        .filter((env) => matchesEnvironment(celExpr, env))
        .map((env) => env.id);

      for (const targetEnvId of targetEnvIds) {
        const existing = deps.get(targetEnvId) ?? [];
        existing.push(...dependencyEnvIds.filter((id) => id !== targetEnvId));
        deps.set(targetEnvId, [...new Set(existing)]);
      }
    }
  }

  return deps;
}

export const useComputedEdges = ({
  environments,
  policies,
}: UseComputedEdgesOptions): Edge[] =>
  useMemo(() => {
    const connections: Edge[] = [];
    const environmentsWithIncoming = new Set<string>();
    const deps = resolveEnvironmentDependencies(policies, environments);

    for (const environment of environments) {
      const dependsOnIds = deps.get(environment.id) ?? [];
      for (const depEnvId of dependsOnIds) {
        connections.push({
          id: `${depEnvId}-${environment.id}`,
          source: depEnvId,
          target: environment.id,
          animated: true,
          style: { stroke: "#3b82f6", strokeWidth: 2 },
        });
        environmentsWithIncoming.add(environment.id);
      }
    }

    for (const environment of environments) {
      if (!environmentsWithIncoming.has(environment.id)) {
        connections.push({
          id: `version-source-${environment.id}`,
          source: "version-source",
          target: environment.id,
          animated: true,
          style: { stroke: "#8b5cf6", strokeWidth: 2 },
        });
      }
    }

    return connections;
  }, [environments, policies]);
