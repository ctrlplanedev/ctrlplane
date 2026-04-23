import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { test } from "../fixtures";

test.describe("Environment API", () => {
  let systemId: string;

  test.beforeAll(async ({ api, workspace }) => {
    const systemRes = await api.POST(
      "/v1/workspaces/{workspaceId}/systems",
      {
        params: { path: { workspaceId: workspace.id } },
        body: {
          name: `test-system-${faker.string.alphanumeric(8)}`,
        },
      },
    );
    expect(systemRes.response.status).toBe(202);
    systemId = systemRes.data!.id;
  });

  test.afterAll(async ({ api, workspace }) => {
    await api.DELETE("/v1/workspaces/{workspaceId}/systems/{systemId}", {
      params: { path: { workspaceId: workspace.id, systemId } },
    });
  });

  test("should create an environment and retrieve it", async ({
    api,
    workspace,
  }) => {
    const name = `env-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/environments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name, description: "Test environment" },
      },
    );

    expect(createRes.response.status).toBe(202);
    const environmentId = createRes.data!.id;

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/environments/{environmentId}",
      {
        params: { path: { workspaceId: workspace.id, environmentId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.id).toBe(environmentId);
    expect(getRes.data!.name).toBe(name);
    expect(getRes.data!.description).toBe("Test environment");

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/environments/{environmentId}",
      { params: { path: { workspaceId: workspace.id, environmentId } } },
    );
  });

  test("should create an environment with a resource selector", async ({
    api,
    workspace,
  }) => {
    const name = `env-sel-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/environments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: {
          name,
          resourceSelector: 'resource.kind == "Service"',
        },
      },
    );

    expect(createRes.response.status).toBe(202);
    const environmentId = createRes.data!.id;

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/environments/{environmentId}",
      {
        params: { path: { workspaceId: workspace.id, environmentId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.resourceSelector).toBe('resource.kind == "Service"');

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/environments/{environmentId}",
      { params: { path: { workspaceId: workspace.id, environmentId } } },
    );
  });

  test("should create an environment with metadata", async ({
    api,
    workspace,
  }) => {
    const name = `env-meta-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/environments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: {
          name,
          metadata: { tier: "staging", region: "us-east-1" },
        },
      },
    );

    expect(createRes.response.status).toBe(202);
    const environmentId = createRes.data!.id;

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/environments/{environmentId}",
      {
        params: { path: { workspaceId: workspace.id, environmentId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.metadata).toEqual({
      tier: "staging",
      region: "us-east-1",
    });

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/environments/{environmentId}",
      { params: { path: { workspaceId: workspace.id, environmentId } } },
    );
  });

  test("should upsert an environment", async ({ api, workspace }) => {
    const name = `env-upsert-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/environments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name },
      },
    );

    expect(createRes.response.status).toBe(202);
    const environmentId = createRes.data!.id;

    const updatedName = `env-upsert-updated-${faker.string.alphanumeric(8)}`;
    const upsertRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/environments/{environmentId}",
      {
        params: { path: { workspaceId: workspace.id, environmentId } },
        body: {
          name: updatedName,
          description: "Updated description",
          resourceSelector: 'resource.kind == "Deployment"',
        },
      },
    );

    expect(upsertRes.response.status).toBe(202);

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/environments/{environmentId}",
      {
        params: { path: { workspaceId: workspace.id, environmentId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.name).toBe(updatedName);
    expect(getRes.data!.description).toBe("Updated description");
    expect(getRes.data!.resourceSelector).toBe('resource.kind == "Deployment"');

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/environments/{environmentId}",
      { params: { path: { workspaceId: workspace.id, environmentId } } },
    );
  });

  test("should delete an environment", async ({ api, workspace }) => {
    const name = `env-del-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/environments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name },
      },
    );

    expect(createRes.response.status).toBe(202);
    const environmentId = createRes.data!.id;

    const deleteRes = await api.DELETE(
      "/v1/workspaces/{workspaceId}/environments/{environmentId}",
      { params: { path: { workspaceId: workspace.id, environmentId } } },
    );

    expect(deleteRes.response.status).toBe(202);

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/environments/{environmentId}",
      {
        params: { path: { workspaceId: workspace.id, environmentId } },
      },
    );

    expect(getRes.response.status).toBe(404);
  });

  test("should return 404 for a non-existent environment", async ({
    api,
    workspace,
  }) => {
    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/environments/{environmentId}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            environmentId: faker.string.uuid(),
          },
        },
      },
    );

    expect(getRes.response.status).toBe(404);
  });

  test("should list environments", async ({ api, workspace }) => {
    const name = `env-list-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/environments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name },
      },
    );

    expect(createRes.response.status).toBe(202);
    const environmentId = createRes.data!.id;

    const listRes = await api.GET(
      "/v1/workspaces/{workspaceId}/environments",
      {
        params: { path: { workspaceId: workspace.id } },
      },
    );

    expect(listRes.response.status).toBe(200);
    expect(listRes.data!.items.some((e) => e.id === environmentId)).toBe(true);

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/environments/{environmentId}",
      { params: { path: { workspaceId: workspace.id, environmentId } } },
    );
  });

  test("should get environment with linked systems", async ({
    api,
    workspace,
  }) => {
    const name = `env-sys-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/environments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name },
      },
    );

    expect(createRes.response.status).toBe(202);
    const environmentId = createRes.data!.id;

    await api.PUT(
      "/v1/workspaces/{workspaceId}/systems/{systemId}/environments/{environmentId}",
      {
        params: {
          path: { workspaceId: workspace.id, systemId, environmentId },
        },
      },
    );

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/environments/{environmentId}",
      {
        params: { path: { workspaceId: workspace.id, environmentId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.systems.some((s) => s.id === systemId)).toBe(true);

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/systems/{systemId}/environments/{environmentId}",
      {
        params: {
          path: { workspaceId: workspace.id, systemId, environmentId },
        },
      },
    );

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/environments/{environmentId}",
      { params: { path: { workspaceId: workspace.id, environmentId } } },
    );
  });

  test("should reject creating an environment with a duplicate name in the same workspace", async ({
    api,
    workspace,
  }) => {
    const name = `env-dup-${faker.string.alphanumeric(8)}`;
    const firstRes = await api.POST(
      "/v1/workspaces/{workspaceId}/environments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name },
      },
    );
    expect(firstRes.response.status).toBe(202);
    const environmentId = firstRes.data!.id;

    const dupRes = await api.POST(
      "/v1/workspaces/{workspaceId}/environments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name },
      },
    );
    expect(dupRes.response.status).toBe(409);

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/environments/{environmentId}",
      { params: { path: { workspaceId: workspace.id, environmentId } } },
    );
  });

  test("should link and unlink an environment to a system", async ({
    api,
    workspace,
  }) => {
    const name = `env-link-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/environments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name },
      },
    );

    expect(createRes.response.status).toBe(202);
    const environmentId = createRes.data!.id;

    const linkRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/systems/{systemId}/environments/{environmentId}",
      {
        params: {
          path: { workspaceId: workspace.id, systemId, environmentId },
        },
      },
    );

    expect(linkRes.response.status).toBe(202);

    const getLinkRes = await api.GET(
      "/v1/workspaces/{workspaceId}/systems/{systemId}/environments/{environmentId}",
      {
        params: {
          path: { workspaceId: workspace.id, systemId, environmentId },
        },
      },
    );

    expect(getLinkRes.response.status).toBe(200);
    expect(getLinkRes.data!.environmentId).toBe(environmentId);
    expect(getLinkRes.data!.systemId).toBe(systemId);

    const unlinkRes = await api.DELETE(
      "/v1/workspaces/{workspaceId}/systems/{systemId}/environments/{environmentId}",
      {
        params: {
          path: { workspaceId: workspace.id, systemId, environmentId },
        },
      },
    );

    expect(unlinkRes.response.status).toBe(202);

    const getLinkAfterUnlink = await api.GET(
      "/v1/workspaces/{workspaceId}/systems/{systemId}/environments/{environmentId}",
      {
        params: {
          path: { workspaceId: workspace.id, systemId, environmentId },
        },
      },
    );

    expect(getLinkAfterUnlink.response.status).toBe(404);

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/environments/{environmentId}",
      { params: { path: { workspaceId: workspace.id, environmentId } } },
    );
  });
});
