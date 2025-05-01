import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import {
  cleanupImportedEntities,
  ImportedEntities,
  importEntitiesFromYaml,
} from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "deployment-remove-event.spec.yaml");

test.describe("Deployment remove event", () => {
  let importedEntities: ImportedEntities;

  test.beforeAll(async ({ api, workspace }) => {
    importedEntities = await importEntitiesFromYaml(
      api,
      workspace.id,
      yamlPath,
    );
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, importedEntities, workspace.id);
  });

  test("deleting a resource should trigger a deployment remove event", async ({
    api,
    workspace,
    page,
  }) => {
    const system = importedEntities.system!;
    const systemPrefix = system.slug.split("-")[0]!;
    const environmentCreateResponse = await api.POST("/v1/environments", {
      body: {
        name: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        systemId: system.id,
        description: faker.lorem.sentence(),
        resourceSelector: {
          type: "identifier",
          operator: "contains",
          value: systemPrefix,
        },
      },
    });
    expect(environmentCreateResponse.response.status).toBe(200);
    expect(environmentCreateResponse.data?.id).toBeDefined();

    const deploymentCreateResponse = await api.POST("/v1/deployments", {
      body: {
        name: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        slug: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        systemId: system.id,
      },
    });
    expect(deploymentCreateResponse.response.status).toBe(201);
    expect(deploymentCreateResponse.data?.id).toBeDefined();

    const deploymentId = deploymentCreateResponse.data?.id ?? "";

    const resourceCreateResponse = await api.POST("/v1/resources", {
      body: {
        name: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        identifier: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        workspaceId: workspace.id,
        kind: "service",
        version: "1.0.0",
        config: {},
      },
    });
    expect(resourceCreateResponse.response.status).toBe(200);
    expect(resourceCreateResponse.data?.id).toBeDefined();

    const resourceId = resourceCreateResponse.data?.id ?? "";

    await page.waitForTimeout(10_000);

    const resourceDeleteResponse = await api.DELETE(
      "/v1/resources/{resourceId}",
      {
        params: {
          path: {
            resourceId,
          },
        },
      },
    );
    expect(resourceDeleteResponse.response.status).toBe(200);

    await page.waitForTimeout(10_000);

    const eventsListResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/events/{action}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            action: "deployment.resource.removed",
          },
        },
      },
    );
    expect(eventsListResponse.response.status).toBe(200);
    const matchedEvent = eventsListResponse.data?.find((event) => {
      const isSameResource = (event.payload.resource as any).id === resourceId;
      const isSameDeployment =
        (event.payload.deployment as any).id === deploymentId;
      return isSameResource && isSameDeployment;
    });
    expect(matchedEvent).toBeDefined();
  });

  test("deleting an environment should trigger a deployment remove event", async ({
    api,
    workspace,
    page,
  }) => {
    const system = importedEntities.system!;
    const systemPrefix = system.slug.split("-")[0]!;
    const environmentCreateResponse = await api.POST("/v1/environments", {
      body: {
        name: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        systemId: system.id,
        description: faker.lorem.sentence(),
        resourceSelector: {
          type: "identifier",
          operator: "contains",
          value: systemPrefix,
        },
      },
    });
    expect(environmentCreateResponse.response.status).toBe(200);
    expect(environmentCreateResponse.data?.id).toBeDefined();

    const environmentId = environmentCreateResponse.data?.id ?? "";

    const deploymentCreateResponse = await api.POST("/v1/deployments", {
      body: {
        name: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        slug: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        systemId: system.id,
      },
    });
    expect(deploymentCreateResponse.response.status).toBe(201);
    expect(deploymentCreateResponse.data?.id).toBeDefined();

    const deploymentId = deploymentCreateResponse.data?.id ?? "";

    const resourceCreateResponse = await api.POST("/v1/resources", {
      body: {
        name: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        identifier: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        workspaceId: workspace.id,
        kind: "service",
        version: "1.0.0",
        config: {},
      },
    });
    expect(resourceCreateResponse.response.status).toBe(200);
    expect(resourceCreateResponse.data?.id).toBeDefined();

    const resourceId = resourceCreateResponse.data?.id ?? "";

    await page.waitForTimeout(10_000);

    const environmentDeleteResponse = await api.DELETE(
      "/v1/environments/{environmentId}",
      {
        params: {
          path: {
            environmentId,
          },
        },
      },
    );
    expect(environmentDeleteResponse.response.status).toBe(200);

    await page.waitForTimeout(10_000);

    const eventsListResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/events/{action}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            action: "deployment.resource.removed",
          },
        },
      },
    );
    expect(eventsListResponse.response.status).toBe(200);
    const matchedEvent = eventsListResponse.data?.find((event) => {
      const isSameResource = (event.payload.resource as any).id === resourceId;
      const isSameDeployment =
        (event.payload.deployment as any).id === deploymentId;
      return isSameResource && isSameDeployment;
    });
    expect(matchedEvent).toBeDefined();
  });

  test("unmatching a resource from an environment via resource update should trigger a deployment remove event", async ({
    api,
    workspace,
    page,
  }) => {
    const system = importedEntities.system!;
    const systemPrefix = system.slug.split("-")[0]!;
    const environmentCreateResponse = await api.POST("/v1/environments", {
      body: {
        name: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        systemId: system.id,
        description: faker.lorem.sentence(),
        resourceSelector: {
          type: "name",
          operator: "contains",
          value: systemPrefix,
        },
      },
    });
    expect(environmentCreateResponse.response.status).toBe(200);
    expect(environmentCreateResponse.data?.id).toBeDefined();

    const deploymentCreateResponse = await api.POST("/v1/deployments", {
      body: {
        name: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        slug: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        systemId: system.id,
      },
    });
    expect(deploymentCreateResponse.response.status).toBe(201);
    expect(deploymentCreateResponse.data?.id).toBeDefined();

    const deploymentId = deploymentCreateResponse.data?.id ?? "";

    const resourceCreateResponse = await api.POST("/v1/resources", {
      body: {
        name: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        identifier: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        workspaceId: workspace.id,
        kind: "service",
        version: "1.0.0",
        config: {},
      },
    });
    expect(resourceCreateResponse.response.status).toBe(200);
    expect(resourceCreateResponse.data?.id).toBeDefined();

    const resourceId = resourceCreateResponse.data?.id ?? "";

    await page.waitForTimeout(10_000);

    const resourceUpdateResponse = await api.PATCH(
      "/v1/resources/{resourceId}",
      {
        params: {
          path: {
            resourceId,
          },
        },
        body: {
          name: faker.string.alphanumeric(8),
        },
      },
    );
    expect(resourceUpdateResponse.response.status).toBe(200);

    await page.waitForTimeout(10_000);

    const eventsListResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/events/{action}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            action: "deployment.resource.removed",
          },
        },
      },
    );
    expect(eventsListResponse.response.status).toBe(200);
    const matchedEvent = eventsListResponse.data?.find((event) => {
      const isSameResource = (event.payload.resource as any).id === resourceId;
      const isSameDeployment =
        (event.payload.deployment as any).id === deploymentId;
      return isSameResource && isSameDeployment;
    });
    expect(matchedEvent).toBeDefined();
  });

  test("unmatching a resource from an environment via env selector update should trigger a deployment remove event", async ({
    api,
    workspace,
    page,
  }) => {
    const system = importedEntities.system!;
    const systemPrefix = system.slug.split("-")[0]!;
    const environmentCreateResponse = await api.POST("/v1/environments", {
      body: {
        name: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        systemId: system.id,
        description: faker.lorem.sentence(),
        resourceSelector: {
          type: "name",
          operator: "contains",
          value: systemPrefix,
        },
      },
    });
    expect(environmentCreateResponse.response.status).toBe(200);
    expect(environmentCreateResponse.data?.name).toBeDefined();
    const environmentName = environmentCreateResponse.data?.name ?? "";

    const deploymentCreateResponse = await api.POST("/v1/deployments", {
      body: {
        name: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        slug: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        systemId: system.id,
      },
    });
    expect(deploymentCreateResponse.response.status).toBe(201);
    expect(deploymentCreateResponse.data?.id).toBeDefined();

    const deploymentId = deploymentCreateResponse.data?.id ?? "";

    const resourceCreateResponse = await api.POST("/v1/resources", {
      body: {
        name: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        identifier: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        workspaceId: workspace.id,
        kind: "service",
        version: "1.0.0",
        config: {},
      },
    });
    expect(resourceCreateResponse.response.status).toBe(200);
    expect(resourceCreateResponse.data?.id).toBeDefined();

    const resourceId = resourceCreateResponse.data?.id ?? "";

    await page.waitForTimeout(10_000);

    const environmentUpdateResponse = await api.POST("/v1/environments", {
      body: {
        name: environmentName,
        systemId: system.id,
        resourceSelector: {
          type: "identifier",
          operator: "contains",
          value: faker.string.alphanumeric(8),
        },
      },
    });
    expect(environmentUpdateResponse.response.status).toBe(200);

    const eventsListResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/events/{action}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            action: "deployment.resource.removed",
          },
        },
      },
    );
    expect(eventsListResponse.response.status).toBe(200);
    const matchedEvent = eventsListResponse.data?.find((event) => {
      const isSameResource = (event.payload.resource as any).id === resourceId;
      const isSameDeployment =
        (event.payload.deployment as any).id === deploymentId;
      return isSameResource && isSameDeployment;
    });
    expect(matchedEvent).toBeDefined();
  });

  test("updating a deployment's resource selector should trigger a deployment remove event if resource is unmatched", async ({
    api,
    workspace,
    page,
  }) => {
    const system = importedEntities.system!;
    const systemPrefix = system.slug.split("-")[0]!;
    const environmentCreateResponse = await api.POST("/v1/environments", {
      body: {
        name: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        systemId: system.id,
        description: faker.lorem.sentence(),
        resourceSelector: {
          type: "name",
          operator: "contains",
          value: systemPrefix,
        },
      },
    });
    expect(environmentCreateResponse.response.status).toBe(200);
    expect(environmentCreateResponse.data?.name).toBeDefined();
    const environmentName = environmentCreateResponse.data?.name ?? "";

    const deploymentCreateResponse = await api.POST("/v1/deployments", {
      body: {
        name: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        slug: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        systemId: system.id,
      },
    });
    expect(deploymentCreateResponse.response.status).toBe(201);
    expect(deploymentCreateResponse.data?.id).toBeDefined();

    const deploymentId = deploymentCreateResponse.data?.id ?? "";

    const resourceCreateResponse = await api.POST("/v1/resources", {
      body: {
        name: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        identifier: `${systemPrefix}-${faker.string.alphanumeric(8)}`,
        workspaceId: workspace.id,
        kind: "service",
        version: "1.0.0",
        config: {},
      },
    });
    expect(resourceCreateResponse.response.status).toBe(200);
    expect(resourceCreateResponse.data?.id).toBeDefined();

    const resourceId = resourceCreateResponse.data?.id ?? "";

    await page.waitForTimeout(10_000);

    const deploymentUpdateResponse = await api.PATCH(
      "/v1/deployments/{deploymentId}",
      {
        params: {
          path: {
            deploymentId,
          },
        },
        body: {
          resourceSelector: {
            type: "identifier",
            operator: "contains",
            value: faker.string.alphanumeric(8),
          },
        },
      },
    );
    expect(deploymentUpdateResponse.response.status).toBe(200);

    await page.waitForTimeout(10_000);

    const eventsListResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/events/{action}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            action: "deployment.resource.removed",
          },
        },
      },
    );
    expect(eventsListResponse.response.status).toBe(200);
    const matchedEvent = eventsListResponse.data?.find((event) => {
      const isSameResource = (event.payload.resource as any).id === resourceId;
      const isSameDeployment =
        (event.payload.deployment as any).id === deploymentId;
      return isSameResource && isSameDeployment;
    });
    expect(matchedEvent).toBeDefined();
  });
});
