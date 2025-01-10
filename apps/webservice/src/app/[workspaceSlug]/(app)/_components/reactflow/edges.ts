import type {
  EnvironmentPolicy,
  EnvironmentPolicyDeployment,
} from "@ctrlplane/db/schema";
import { MarkerType } from "reactflow";
import colors from "tailwindcss/colors";
import { isPresent } from "ts-is-present";

const markerEnd = {
  type: MarkerType.Arrow,
  color: colors.neutral[700],
};

export const createEdgesWhereEnvironmentHasNoPolicy = (
  envs: Array<{ id: string; policyId?: string | null }>,
) =>
  envs.map((e) => {
    const source = isPresent(e.policyId) ? e.policyId : "trigger";
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
  policyDeployments: Array<EnvironmentPolicyDeployment>,
) =>
  policyDeployments.map((p) => ({
    id: p.id,
    source: p.environmentId,
    target: p.policyId,
    markerEnd,
  }));

export const createEdgesWherePolicyHasNoEnvironment = (
  policies: Array<EnvironmentPolicy>,
  policyDeployments: Array<EnvironmentPolicyDeployment>,
) =>
  policies
    .filter((t) => !policyDeployments.some((p) => p.policyId === t.id))
    .map((e) => ({
      id: "trigger-" + e.id,
      source: "trigger",
      target: e.id,
      markerEnd,
    }));
