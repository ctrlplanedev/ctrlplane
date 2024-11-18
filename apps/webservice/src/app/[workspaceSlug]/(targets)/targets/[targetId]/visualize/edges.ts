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

type System = SCHEMA.System & {
  environments: SCHEMA.Environment[];
  deployments: SCHEMA.Deployment[];
};

export const createEdgesFromEnvironmentsToSystems = (systems: System[]) =>
  systems.flatMap((system) =>
    system.environments.map((environment) => ({
      id: `${environment.id}-${system.id}`,
      source: environment.id,
      target: system.id,
      style: { stroke: colors.neutral[700] },
      markerEnd,
      label: "part of",
    })),
  );

export const createEdgesFromSystemsToDeployments = (systems: System[]) =>
  systems.flatMap((system) =>
    system.deployments.map((deployment) => ({
      id: `${system.id}-${deployment.id}`,
      source: system.id,
      target: deployment.id,
      style: { stroke: colors.neutral[700] },
      markerEnd,
      label: "deploys",
    })),
  );

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
