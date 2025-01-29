import type * as SCHEMA from "@ctrlplane/db/schema";
import { MarkerType } from "reactflow";
import colors from "tailwindcss/colors";

const markerEnd = {
  type: MarkerType.Arrow,
  color: colors.neutral[700],
};

export const createEdgesWhereEnvironmentHasNoPolicy = (
  envs: SCHEMA.Environment[],
  standalonePolicies: SCHEMA.EnvironmentPolicy[],
) =>
  envs.map((e) => {
    const isUsingStandalonePolicy = standalonePolicies.some(
      (p) => p.id === e.policyId,
    );
    const source = isUsingStandalonePolicy ? e.policyId : "trigger";
    return {
      id: source + "-" + e.id,
      source,
      target: e.id,
      markerEnd,
    };
  });

export const createEdgesFromPolicyToEnvironment = (
  envs: Array<{ id: string; policyId?: string | null }>,
) =>
  envs.map((e) => ({
    id: `${e.policyId ?? "trigger"}-${e.id}`,
    source: e.policyId ?? "trigger",
    target: e.id,
    markerEnd,
  }));

export const createEdgesFromPolicyDeployment = (
  policyDeployments: Array<SCHEMA.EnvironmentPolicyDeployment>,
) =>
  policyDeployments.map((p) => ({
    id: p.id,
    source: p.environmentId,
    target: p.policyId,
    markerEnd,
  }));

export const createEdgesWherePolicyHasNoEnvironment = (
  policies: Array<SCHEMA.EnvironmentPolicy>,
  policyDeployments: Array<SCHEMA.EnvironmentPolicyDeployment>,
) =>
  policies
    .filter((t) => !policyDeployments.some((p) => p.policyId === t.id))
    .map((e) => ({
      id: "trigger-" + e.id,
      source: "trigger",
      target: e.id,
      markerEnd,
    }));
