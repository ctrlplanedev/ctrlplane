import { faker } from "@faker-js/faker";
import _ from "lodash";

import { ApiClient } from ".";

export type ExampleSystem = Awaited<ReturnType<typeof createExampleSystem>>;

export const createExampleSystem = async (
  api: ApiClient,
  workspaceId: string,
) => {
  const resourceKind = faker.word.noun();
  const systemName = faker.string.alphanumeric(10);
  const system = await api.POST("/v1/systems", {
    body: { name: systemName, workspaceId, slug: systemName },
  });

  const qaResources = _.range(10).map((i) => ({
    name: `Test Resource ${i}`,
    kind: resourceKind,
    identifier: `${systemName}-qa-${resourceKind}-${i}`,
    version: "test-version",
    config: {},
    metadata: {
      env: "qa",
    },
    variables: [
      {
        key: "test-variable",
        value: "test-value",
        sensitive: false,
      },
    ],
  }));

  const prodResources = _.range(10).map((i) => ({
    name: `Test Resource ${i}`,
    kind: resourceKind,
    identifier: `${systemName}-prod-${resourceKind}-${i}`,
    version: "test-version",
    config: {},
    metadata: {
      env: "prod",
    },
    variables: [
      {
        key: "test-variable",
        value: "test-value",
        sensitive: false,
      },
    ],
  }));

  await api.POST("/v1/resources", {
    body: { workspaceId, resources: [...qaResources, ...prodResources] },
  });

  const qaEnvironment = await api.POST("/v1/environments", {
    body: {
      name: "QA",
      workspaceId,
      systemId: system.data!.id,
      resourceSelector: {
        type: "metadata",
        operator: "equals",
        key: "env",
        value: "qa",
      },
    },
  });

  const prodEnvironment = await api.POST("/v1/environments", {
    body: {
      name: "Prod",
      workspaceId,
      systemId: system.data!.id,
      resourceSelector: {
        type: "metadata",
        operator: "equals",
        key: "env",
        value: "prod",
      },
    },
  });

  const deploymentA = await api.POST("/v1/deployments", {
    body: {
      name: "Deployment A",
      systemId: system.data!.id,
      slug: "deployment-a",
    },
  });
  const deploymentB = await api.POST("/v1/deployments", {
    body: {
      name: "Deployment B",
      systemId: system.data!.id,
      slug: "deployment-b",
    },
  });

  const deploymentWithSelector = await api.POST("/v1/deployments", {
    body: {
      name: "Deployment With Selector",
      systemId: system.data!.id,
      slug: "deployment-with-selector",
      resourceSelector: {
        type: "metadata",
        operator: "equals",
        key: "env",
        value: "qa",
      } as any,
    },
  });

  return {
    system: system.data!,
    resources: { qa: qaResources, prod: prodResources },
    environments: { qa: qaEnvironment.data!, prod: prodEnvironment.data! },
    deployments: {
      a: deploymentA.data!,
      b: deploymentB.data!,
      withSelectorForQa: deploymentWithSelector.data!,
    },
  };
};
