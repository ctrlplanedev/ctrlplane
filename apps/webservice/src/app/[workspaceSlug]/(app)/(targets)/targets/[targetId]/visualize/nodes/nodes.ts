import type { RouterOutputs } from "@ctrlplane/api";
import type { NodeTypes } from "reactflow";
import { isPresent } from "ts-is-present";

import { DeploymentNode } from "./DeploymentNode";
import { EnvironmentNode } from "./EnvironmentNode";
import { ProviderNode } from "./ProviderNode";
import { ResourceNode } from "./ResourceNode";

type Relationships = NonNullable<RouterOutputs["resource"]["relationships"]>;

enum NodeType {
  Resource = "resource",
  Environment = "environment",
  Provider = "provider",
  Deployment = "deployment",
}

export const nodeTypes: NodeTypes = {
  [NodeType.Resource]: ResourceNode,
  [NodeType.Environment]: EnvironmentNode,
  [NodeType.Provider]: ProviderNode,
  [NodeType.Deployment]: DeploymentNode,
};

const getResourceNodes = (relationships: Relationships) =>
  relationships.nodes.map((r) => ({
    id: r.id,
    type: NodeType.Resource,
    data: {
      ...r,
      label: r.identifier,
      isBaseNode: r.id === relationships.resource.id,
    },
    position: { x: 0, y: 0 },
  }));

const getProviderNodes = (relationships: Relationships) =>
  relationships.nodes
    .map((r) =>
      r.provider != null
        ? {
            id: `${r.provider.id}-${r.id}`,
            type: NodeType.Provider,
            data: { ...r.provider, label: r.provider.name },
            position: { x: 0, y: 0 },
          }
        : null,
    )
    .filter(isPresent);

const getEnvironmentNodes = (relationships: Relationships) =>
  relationships.nodes
    .flatMap((r) => r.workspace.systems)
    .flatMap((s) => s.environments.map((e) => ({ s, e })))
    .map(({ s, e }) => ({
      id: e.id,
      type: NodeType.Environment,
      data: { environment: e, label: `${s.name}/${e.name}` },
      position: { x: 0, y: 0 },
    }));

const getDeploymentNodes = (relationships: Relationships) =>
  relationships.nodes.flatMap((r) =>
    r.workspace.systems.flatMap((system) =>
      system.environments.flatMap((environment) =>
        system.deployments.map((deployment) => ({
          id: `${environment.id}-${deployment.id}`,
          type: NodeType.Deployment,
          data: {
            deployment,
            environment,
            resource: r,
            label: deployment.name,
          },
          position: { x: 0, y: 0 },
        })),
      ),
    ),
  );

export const getNodes = (relationships: Relationships) =>
  [
    ...getResourceNodes(relationships),
    ...getProviderNodes(relationships),
    ...getEnvironmentNodes(relationships),
    ...getDeploymentNodes(relationships),
  ].filter(isPresent);
