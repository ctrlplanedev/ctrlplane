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
        source: provider.id,
        target: resource.id,
        style: { stroke: colors.neutral[700] },
        markerEnd,
        label: "discovered",
      }
    : null;
