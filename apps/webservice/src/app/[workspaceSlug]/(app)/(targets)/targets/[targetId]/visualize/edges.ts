import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";
import type { EdgeTypes } from "reactflow";
import { MarkerType } from "reactflow";
import colors from "tailwindcss/colors";
import { isPresent } from "ts-is-present";

import { DepEdge } from "./DepEdge";

type Provider = SCHEMA.ResourceProvider & {
  google: SCHEMA.ResourceProviderGoogle | null;
};

const markerEnd = {
  type: MarkerType.Arrow,
  color: colors.neutral[800],
};

export const edgeTypes: EdgeTypes = { default: DepEdge };

const createEdgesFromResourceToEnvironments = (
  resource: SCHEMA.Resource,
  environments: SCHEMA.Environment[],
) =>
  environments.map((environment) => ({
    id: `${resource.id}-${environment.id}`,
    source: resource.id,
    target: environment.id,
    style: { stroke: colors.neutral[800] },
    markerEnd,
    label: "in",
  }));

const createEdgeFromProviderToResource = (
  provider: Provider | null,
  resource: SCHEMA.Resource,
) =>
  provider != null
    ? {
        id: `${provider.id}-${resource.id}`,
        source: `${provider.id}-${resource.id}`,
        target: resource.id,
        style: { stroke: colors.neutral[800] },
        markerEnd,
        label: "discovered",
      }
    : null;

type Relationships = NonNullable<RouterOutputs["resource"]["relationships"]>;

const createEdgesFromEnvironmentToDeployments = (
  environments: SCHEMA.Environment[],
  deployments: SCHEMA.Deployment[],
) =>
  environments
    .flatMap((e) => deployments.map((d) => ({ e, d })))
    .map(({ e, d }) => ({
      id: `${e.id}-${d.id}`,
      source: e.id,
      target: `${e.id}-${d.id}`,
      label: "deploys",
      style: { stroke: colors.neutral[800] },
      markerEnd,
    }));

const createEdgesFromDeploymentsToResources = (relationships: Relationships) =>
  relationships.map((resource) => {
    const { parent } = resource;
    if (parent == null) return null;

    const allReleaseJobTriggers = relationships
      .flatMap((r) => r.workspace.systems)
      .flatMap((s) => s.environments)
      .flatMap((e) => e.latestActiveReleases)
      .map((rel) => rel.releaseJobTrigger);

    const releaseJobTrigger = allReleaseJobTriggers.find(
      (j) => j.jobId === parent.jobId,
    );
    if (releaseJobTrigger == null) return null;

    const { deploymentId } = releaseJobTrigger.release;
    const { environmentId } = releaseJobTrigger;

    return {
      id: `${releaseJobTrigger.jobId}-${resource.id}`,
      source: `${environmentId}-${deploymentId}`,
      target: resource.id,
      style: { stroke: colors.neutral[800] },
      markerEnd,
      label: "created",
    };
  });

export const getEdges = (relationships: Relationships) => {
  const resourceToEnvEdges = relationships.flatMap((r) =>
    createEdgesFromResourceToEnvironments(
      r,
      r.workspace.systems.flatMap((s) => s.environments),
    ),
  );
  const environmentToDeploymentEdges = relationships.flatMap((r) =>
    r.workspace.systems.flatMap((s) =>
      createEdgesFromEnvironmentToDeployments(s.environments, s.deployments),
    ),
  );
  const providerEdges = relationships.flatMap((r) =>
    r.provider != null ? [createEdgeFromProviderToResource(r.provider, r)] : [],
  );
  const deploymentEdges = createEdgesFromDeploymentsToResources(relationships);

  return [
    ...resourceToEnvEdges,
    ...environmentToDeploymentEdges,
    ...providerEdges,
    ...deploymentEdges,
  ].filter(isPresent);
};
