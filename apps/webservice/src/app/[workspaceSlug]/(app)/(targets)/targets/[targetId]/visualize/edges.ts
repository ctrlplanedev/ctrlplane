import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";
import { MarkerType } from "reactflow";
import colors from "tailwindcss/colors";

type Provider = SCHEMA.ResourceProvider & {
  google: SCHEMA.ResourceProviderGoogle | null;
};

const markerEnd = {
  type: MarkerType.Arrow,
  color: colors.neutral[700],
};

export const createEdgesFromResourceToEnvironments = (
  resource: SCHEMA.Resource,
  environments: SCHEMA.Environment[],
) =>
  environments.map((environment) => ({
    id: `${resource.id}-${environment.id}`,
    source: resource.id,
    target: environment.id,
    style: { stroke: colors.neutral[700] },
    markerEnd,
    label: "in",
  }));

export const createEdgeFromProviderToResource = (
  provider: Provider | null,
  resource: SCHEMA.Resource,
) =>
  provider != null
    ? {
        id: `${provider.id}-${resource.id}`,
        source: `${provider.id}-${resource.id}`,
        target: resource.id,
        style: { stroke: colors.neutral[700] },
        markerEnd,
        label: "discovered",
      }
    : null;

type Relationships = NonNullable<RouterOutputs["resource"]["relationships"]>;

export const createEdgesFromDeploymentsToResources = (
  relationships: Relationships,
) =>
  relationships.map((resource) => {
    const { parent } = resource;
    if (parent == null) return null;

    const allReleaseJobTriggers = relationships.flatMap((r) =>
      r.workspace.systems.flatMap((s) =>
        s.environments.flatMap((e) =>
          e.latestActiveRelease.map((rel) => rel.releaseJobTrigger),
        ),
      ),
    );

    const releaseJobTrigger = allReleaseJobTriggers.find(
      (j) => j.jobId === parent.jobId,
    );
    if (releaseJobTrigger == null) return null;

    return {
      id: `${releaseJobTrigger.jobId}-${resource.id}`,
      source: releaseJobTrigger.environmentId,
      sourceHandle: releaseJobTrigger.jobId,
      target: resource.id,
      style: { stroke: colors.neutral[700] },
      markerEnd,
      label: "created",
    };
  });
