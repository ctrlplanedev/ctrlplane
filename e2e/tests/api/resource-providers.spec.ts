import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";
import { v4 as uuidv4 } from "uuid";

import { test } from "../fixtures";

test.describe("Resource Provider API", () => {
  test("should upsert a resource provider and retrieve it", async ({
    api,
    workspace,
  }) => {
    const name = `provider-${faker.string.alphanumeric(8)}`;
    const upsertRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/resource-providers",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { id: uuidv4(), name },
      },
    );

    try {
      expect(upsertRes.response.status).toBe(202);
      expect(upsertRes.data!.name).toBe(name);
      expect(upsertRes.data!.workspaceId).toBe(workspace.id);

      const getRes = await api.GET(
        "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
        {
          params: { path: { workspaceId: workspace.id, name } },
        },
      );

      expect(getRes.response.status).toBe(200);
      expect(getRes.data!.name).toBe(name);
      expect(getRes.data!.workspaceId).toBe(workspace.id);
      expect(getRes.data!.id).toBe(upsertRes.data!.id);
    } finally {
      await api.DELETE(
        "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
        {
          params: { path: { workspaceId: workspace.id, name } },
        },
      );
    }
  });

  test("should return same provider on second upsert with same name", async ({
    api,
    workspace,
  }) => {
    const name = `provider-idem-${faker.string.alphanumeric(8)}`;

    const firstRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/resource-providers",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { id: uuidv4(), name },
      },
    );

    try {
      expect(firstRes.response.status).toBe(202);
      const firstId = firstRes.data!.id;

      const secondRes = await api.PUT(
        "/v1/workspaces/{workspaceId}/resource-providers",
        {
          params: { path: { workspaceId: workspace.id } },
          body: { id: uuidv4(), name },
        },
      );
      expect(secondRes.response.status).toBe(202);

      // Should return the same provider (same id)
      expect(secondRes.data!.id).toBe(firstId);
      expect(secondRes.data!.name).toBe(name);
    } finally {
      await api.DELETE(
        "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
        {
          params: { path: { workspaceId: workspace.id, name } },
        },
      );
    }
  });

  test("should return 404 for non-existent resource provider", async ({
    api,
    workspace,
  }) => {
    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            name: `nonexistent-${faker.string.alphanumeric(8)}`,
          },
        },
      },
    );

    expect(getRes.response.status).toBe(404);
  });

  test("should delete a resource provider", async ({ api, workspace }) => {
    const name = `provider-del-${faker.string.alphanumeric(8)}`;

    await api.PUT("/v1/workspaces/{workspaceId}/resource-providers", {
      params: { path: { workspaceId: workspace.id } },
      body: { id: uuidv4(), name },
    });

    const deleteRes = await api.DELETE(
      "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
      {
        params: { path: { workspaceId: workspace.id, name } },
      },
    );

    expect(deleteRes.response.status).toBe(202);

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
      {
        params: { path: { workspaceId: workspace.id, name } },
      },
    );

    expect(getRes.response.status).toBe(404);
  });

  test("should return 404 when deleting a non-existent resource provider", async ({
    api,
    workspace,
  }) => {
    const deleteRes = await api.DELETE(
      "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            name: `nonexistent-${faker.string.alphanumeric(8)}`,
          },
        },
      },
    );

    expect(deleteRes.response.status).toBe(404);
  });

  test("should return 400 when deleting a resource provider that has resources", async ({
    api,
    workspace,
  }) => {
    const name = `provider-has-res-${faker.string.alphanumeric(8)}`;

    const upsertRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/resource-providers",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { id: uuidv4(), name },
      },
    );
    expect(upsertRes.response.status).toBe(202);
    const providerId = upsertRes.data!.id;

    try {
      await api.PUT(
        "/v1/workspaces/{workspaceId}/resource-providers/{providerId}/set",
        {
          params: { path: { workspaceId: workspace.id, providerId } },
          body: {
            resources: [
              {
                createdAt: new Date().toISOString(),
                identifier: `res-${faker.string.alphanumeric(8)}`,
                name: "Test Resource",
                kind: "TestKind",
                version: "1.0.0",
                config: {},
                metadata: {},
              },
            ],
          },
        },
      );

      const deleteRes = await api.DELETE(
        "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
        {
          params: { path: { workspaceId: workspace.id, name } },
        },
      );

      expect(deleteRes.response.status).toBe(400);
    } finally {
      // Cleanup: remove resources first, then delete provider
      await api.PUT(
        "/v1/workspaces/{workspaceId}/resource-providers/{providerId}/set",
        {
          params: { path: { workspaceId: workspace.id, providerId } },
          body: { resources: [] },
        },
      );
      await api.DELETE(
        "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
        {
          params: { path: { workspaceId: workspace.id, name } },
        },
      );
    }
  });

  test("should set resources on a provider and retrieve them", async ({
    api,
    workspace,
  }) => {
    const name = `provider-set-${faker.string.alphanumeric(8)}`;
    const upsertRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/resource-providers",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { id: uuidv4(), name },
      },
    );
    expect(upsertRes.response.status).toBe(202);
    const providerId = upsertRes.data!.id;

    try {
      const identifier1 = `res-set-a-${faker.string.alphanumeric(8)}`;
      const identifier2 = `res-set-b-${faker.string.alphanumeric(8)}`;

      const setRes = await api.PUT(
        "/v1/workspaces/{workspaceId}/resource-providers/{providerId}/set",
        {
          params: { path: { workspaceId: workspace.id, providerId } },
          body: {
            resources: [
              {
                createdAt: new Date().toISOString(),
                identifier: identifier1,
                name: "Resource A",
                kind: "KindA",
                version: "1.0.0",
                config: { key: "a" },
                metadata: { env: "test" },
              },
              {
                createdAt: new Date().toISOString(),
                identifier: identifier2,
                name: "Resource B",
                kind: "KindB",
                version: "2.0.0",
                config: { key: "b" },
                metadata: { env: "prod" },
              },
            ],
          },
        },
      );

      expect(setRes.response.status).toBe(202);
      expect(setRes.data!.ok).toBe(true);

      const getRes = await api.GET(
        "/v1/workspaces/{workspaceId}/resource-providers/name/{name}/resources",
        {
          params: { path: { workspaceId: workspace.id, name } },
        },
      );

      expect(getRes.response.status).toBe(200);
      expect(getRes.data!.items).toHaveLength(2);
      expect(getRes.data!.items.some((r) => r.identifier === identifier1)).toBe(
        true,
      );
      expect(getRes.data!.items.some((r) => r.identifier === identifier2)).toBe(
        true,
      );
    } finally {
      await api.PUT(
        "/v1/workspaces/{workspaceId}/resource-providers/{providerId}/set",
        {
          params: { path: { workspaceId: workspace.id, providerId } },
          body: { resources: [] },
        },
      );
      await api.DELETE(
        "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
        {
          params: { path: { workspaceId: workspace.id, name } },
        },
      );
    }
  });

  test("should replace resources on second set call", async ({
    api,
    workspace,
  }) => {
    const name = `provider-replace-${faker.string.alphanumeric(8)}`;
    const upsertRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/resource-providers",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { id: uuidv4(), name },
      },
    );
    expect(upsertRes.response.status).toBe(202);
    const providerId = upsertRes.data!.id;

    try {
      const oldIdentifier = `res-old-${faker.string.alphanumeric(8)}`;
      const newIdentifier = `res-new-${faker.string.alphanumeric(8)}`;

      // First set
      await api.PUT(
        "/v1/workspaces/{workspaceId}/resource-providers/{providerId}/set",
        {
          params: { path: { workspaceId: workspace.id, providerId } },
          body: {
            resources: [
              {
                createdAt: new Date().toISOString(),
                identifier: oldIdentifier,
                name: "Old Resource",
                kind: "TestKind",
                version: "1.0.0",
                config: {},
                metadata: {},
              },
            ],
          },
        },
      );

      // Second set replaces with different resource
      await api.PUT(
        "/v1/workspaces/{workspaceId}/resource-providers/{providerId}/set",
        {
          params: { path: { workspaceId: workspace.id, providerId } },
          body: {
            resources: [
              {
                createdAt: new Date().toISOString(),
                identifier: newIdentifier,
                name: "New Resource",
                kind: "TestKind",
                version: "1.0.0",
                config: {},
                metadata: {},
              },
            ],
          },
        },
      );

      const getRes = await api.GET(
        "/v1/workspaces/{workspaceId}/resource-providers/name/{name}/resources",
        {
          params: { path: { workspaceId: workspace.id, name } },
        },
      );

      expect(getRes.response.status).toBe(200);
      expect(getRes.data!.items).toHaveLength(1);
      expect(getRes.data!.items[0]!.identifier).toBe(newIdentifier);
    } finally {
      await api.PUT(
        "/v1/workspaces/{workspaceId}/resource-providers/{providerId}/set",
        {
          params: { path: { workspaceId: workspace.id, providerId } },
          body: { resources: [] },
        },
      );
      await api.DELETE(
        "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
        {
          params: { path: { workspaceId: workspace.id, name } },
        },
      );
    }
  });

  test("should remove all resources when set with empty list", async ({
    api,
    workspace,
  }) => {
    const name = `provider-empty-${faker.string.alphanumeric(8)}`;
    const upsertRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/resource-providers",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { id: uuidv4(), name },
      },
    );
    expect(upsertRes.response.status).toBe(202);
    const providerId = upsertRes.data!.id;

    try {
      await api.PUT(
        "/v1/workspaces/{workspaceId}/resource-providers/{providerId}/set",
        {
          params: { path: { workspaceId: workspace.id, providerId } },
          body: {
            resources: [
              {
                createdAt: new Date().toISOString(),
                identifier: `res-${faker.string.alphanumeric(8)}`,
                name: "Will Be Removed",
                kind: "TestKind",
                version: "1.0.0",
                config: {},
                metadata: {},
              },
            ],
          },
        },
      );

      // Set empty
      const emptySetRes = await api.PUT(
        "/v1/workspaces/{workspaceId}/resource-providers/{providerId}/set",
        {
          params: { path: { workspaceId: workspace.id, providerId } },
          body: { resources: [] },
        },
      );
      expect(emptySetRes.response.status).toBe(202);

      const getRes = await api.GET(
        "/v1/workspaces/{workspaceId}/resource-providers/name/{name}/resources",
        {
          params: { path: { workspaceId: workspace.id, name } },
        },
      );

      expect(getRes.response.status).toBe(200);
      expect(getRes.data!.items).toHaveLength(0);
    } finally {
      await api.PUT(
        "/v1/workspaces/{workspaceId}/resource-providers/{providerId}/set",
        {
          params: { path: { workspaceId: workspace.id, providerId } },
          body: { resources: [] },
        },
      );
      await api.DELETE(
        "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
        {
          params: { path: { workspaceId: workspace.id, name } },
        },
      );
    }
  });

  test("should return 404 when getting resources for unknown provider", async ({
    api,
    workspace,
  }) => {
    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/resource-providers/name/{name}/resources",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            name: `nonexistent-${faker.string.alphanumeric(8)}`,
          },
        },
      },
    );

    expect(getRes.response.status).toBe(404);
  });
});
