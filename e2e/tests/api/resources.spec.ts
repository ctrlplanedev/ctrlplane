import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { test } from "../fixtures";

test.describe("Resource API", () => {
  test("should upsert a resource and retrieve it", async ({
    api,
    workspace,
  }) => {
    const identifier = `res-${faker.string.alphanumeric(8)}`;
    const upsertRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
        body: {
          name: "Test Resource",
          kind: "TestKind",
          version: "1.0.0",
          config: { key: "value" },
          metadata: { env: "test" },
        },
      },
    );

    expect(upsertRes.response.status).toBe(202);

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.identifier).toBe(identifier);
    expect(getRes.data!.name).toBe("Test Resource");
    expect(getRes.data!.kind).toBe("TestKind");
    expect(getRes.data!.version).toBe("1.0.0");
    expect(getRes.data!.config).toEqual({ key: "value" });
    expect(getRes.data!.metadata).toEqual({ env: "test" });

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
      },
    );
  });

  test("should update a resource on second upsert", async ({
    api,
    workspace,
  }) => {
    const identifier = `res-${faker.string.alphanumeric(8)}`;
    await api.PUT(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
        body: {
          name: "Original",
          kind: "TestKind",
          version: "1.0.0",
          config: {},
          metadata: { a: "1" },
        },
      },
    );

    const upsertRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
        body: {
          name: "Updated",
          kind: "TestKind",
          version: "2.0.0",
          config: { new: "config" },
          metadata: { b: "2" },
        },
      },
    );

    expect(upsertRes.response.status).toBe(202);

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.name).toBe("Updated");
    expect(getRes.data!.version).toBe("2.0.0");
    expect(getRes.data!.config).toEqual({ new: "config" });
    expect(getRes.data!.metadata).toEqual({ b: "2" });

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
      },
    );
  });

  test("should delete a resource", async ({ api, workspace }) => {
    const identifier = `res-${faker.string.alphanumeric(8)}`;
    await api.PUT(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
        body: {
          name: "To Delete",
          kind: "TestKind",
          version: "1.0.0",
          config: {},
          metadata: {},
        },
      },
    );

    const deleteRes = await api.DELETE(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
      },
    );

    expect(deleteRes.response.status).toBe(200);

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
      },
    );

    expect(getRes.response.status).toBe(404);
  });

  test("should return 404 for non-existent resource", async ({
    api,
    workspace,
  }) => {
    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: `nonexistent-${faker.string.alphanumeric(8)}`,
          },
        },
      },
    );

    expect(getRes.response.status).toBe(404);
  });

  test("should list resources", async ({ api, workspace }) => {
    const identifier = `res-list-${faker.string.alphanumeric(8)}`;
    const upsertRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
        body: {
          name: "List Test",
          kind: "TestKind",
          version: "1.0.0",
          config: {},
          metadata: {},
        },
      },
    );

    const listRes = await api.GET("/v1/workspaces/{workspaceId}/resources", {
      params: { path: { workspaceId: workspace.id } },
    });

    expect(listRes.response.status).toBe(200);
    expect(listRes.data!.items.some((r) => r.identifier === identifier)).toBe(
      true,
    );

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
      },
    );
  });

  test("should list resources with CEL filter", async ({ api, workspace }) => {
    const identifier1 = `res-cel-a-${faker.string.alphanumeric(8)}`;
    const identifier2 = `res-cel-b-${faker.string.alphanumeric(8)}`;

    await api.PUT(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier: identifier1 },
        },
        body: {
          name: "CEL Match",
          kind: "FilterKind",
          version: "1.0.0",
          config: {},
          metadata: {},
        },
      },
    );

    await api.PUT(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier: identifier2 },
        },
        body: {
          name: "CEL NoMatch",
          kind: "OtherKind",
          version: "1.0.0",
          config: {},
          metadata: {},
        },
      },
    );

    const listRes = await api.GET("/v1/workspaces/{workspaceId}/resources", {
      params: {
        path: { workspaceId: workspace.id },
        query: { cel: 'resource.kind == "FilterKind"' },
      },
    });

    expect(listRes.response.status).toBe(200);
    expect(listRes.data!.items.some((r) => r.identifier === identifier1)).toBe(
      true,
    );
    expect(listRes.data!.items.some((r) => r.identifier === identifier2)).toBe(
      false,
    );

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier: identifier1 },
        },
      },
    );
    await api.DELETE(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier: identifier2 },
        },
      },
    );
  });

  test("should upsert a resource with variables", async ({
    api,
    workspace,
  }) => {
    const identifier = `res-vars-${faker.string.alphanumeric(8)}`;
    await api.PUT(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
        body: {
          name: "With Vars",
          kind: "TestKind",
          version: "1.0.0",
          config: {},
          metadata: {},
          variables: { DB_HOST: "localhost", DB_PORT: "port-5432" },
        },
      },
    );

    const varsRes = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}/variables",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
      },
    );

    expect(varsRes.response.status).toBe(200);
    const vars = varsRes.data!.items;
    expect(vars).toHaveLength(2);
    expect(vars.find((v) => v.key === "DB_HOST")?.value).toBe("localhost");
    expect(vars.find((v) => v.key === "DB_PORT")?.value).toBe("port-5432");

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
      },
    );
  });

  test("should update variables via PATCH", async ({ api, workspace }) => {
    const identifier = `res-patch-${faker.string.alphanumeric(8)}`;
    await api.PUT(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
        body: {
          name: "Patch Vars",
          kind: "TestKind",
          version: "1.0.0",
          config: {},
          metadata: {},
          variables: { OLD_KEY: "old_value" },
        },
      },
    );

    const patchRes = await api.PATCH(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}/variables",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
        body: { NEW_KEY: "new_value", ANOTHER: "val" },
      },
    );

    expect(patchRes.response.status).toBe(202);

    const varsRes = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}/variables",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
      },
    );

    expect(varsRes.response.status).toBe(200);
    const vars = varsRes.data!.items;
    expect(vars).toHaveLength(2);
    expect(vars.find((v) => v.key === "NEW_KEY")?.value).toBe("new_value");
    expect(vars.find((v) => v.key === "ANOTHER")?.value).toBe("val");
    expect(vars.find((v) => v.key === "OLD_KEY")).toBeUndefined();

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
      },
    );
  });

  test("should replace variables on re-upsert", async ({ api, workspace }) => {
    const identifier = `res-revar-${faker.string.alphanumeric(8)}`;
    await api.PUT(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
        body: {
          name: "Revar",
          kind: "TestKind",
          version: "1.0.0",
          config: {},
          metadata: {},
          variables: { FIRST: "val-1", SECOND: "val-2" },
        },
      },
    );

    await api.PUT(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
        body: {
          name: "Revar",
          kind: "TestKind",
          version: "1.0.0",
          config: {},
          metadata: {},
          variables: { THIRD: "val-3" },
        },
      },
    );

    const varsRes = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}/variables",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
      },
    );

    expect(varsRes.response.status).toBe(200);
    const vars = varsRes.data!.items;
    expect(vars).toHaveLength(1);
    expect(vars[0]!.key).toBe("THIRD");
    expect(vars[0]!.value).toBe("val-3");

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier },
        },
      },
    );
  });
});
