import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";
import { v4 as uuidv4 } from "uuid";

import { test } from "../fixtures";

test.describe("Secret Provider API", () => {
  test("upserts, retrieves, lists, and deletes a provider", async ({
    api,
    workspace,
  }) => {
    const providerId = uuidv4();
    const name = `sp-${faker.string.alphanumeric(8)}`;

    const upsertRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/secret-providers/{providerId}",
      {
        params: { path: { workspaceId: workspace.id, providerId } },
        body: {
          name,
          type: "doppler",
          config: { serviceToken: "dp.st.testtoken1234567890" },
        },
      },
    );

    try {
      expect(upsertRes.response.status).toBe(202);
      expect(upsertRes.data!.id).toBe(providerId);

      const getRes = await api.GET(
        "/v1/workspaces/{workspaceId}/secret-providers/{providerId}",
        {
          params: { path: { workspaceId: workspace.id, providerId } },
        },
      );

      expect(getRes.response.status).toBe(200);
      expect(getRes.data!.id).toBe(providerId);
      expect(getRes.data!.name).toBe(name);
      expect(getRes.data!.type).toBe("doppler");
      expect(getRes.data!.workspaceId).toBe(workspace.id);
      // Encrypted config must never be returned.
      expect((getRes.data as Record<string, unknown>).config).toBeUndefined();

      const listRes = await api.GET(
        "/v1/workspaces/{workspaceId}/secret-providers",
        {
          params: { path: { workspaceId: workspace.id } },
        },
      );

      expect(listRes.response.status).toBe(200);
      expect(listRes.data!.items.some((p) => p.id === providerId)).toBe(true);
      expect(
        listRes.data!.items.every(
          (p) => (p as Record<string, unknown>).config === undefined,
        ),
      ).toBe(true);
    } finally {
      await api.DELETE(
        "/v1/workspaces/{workspaceId}/secret-providers/{providerId}",
        {
          params: { path: { workspaceId: workspace.id, providerId } },
        },
      );
    }
  });

  test("rejects unknown providerId on get", async ({ api, workspace }) => {
    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/secret-providers/{providerId}",
      {
        params: { path: { workspaceId: workspace.id, providerId: uuidv4() } },
      },
    );

    expect(getRes.response.status).toBe(404);
  });

  test("rejects delete on unknown providerId", async ({ api, workspace }) => {
    const deleteRes = await api.DELETE(
      "/v1/workspaces/{workspaceId}/secret-providers/{providerId}",
      {
        params: { path: { workspaceId: workspace.id, providerId: uuidv4() } },
      },
    );

    expect(deleteRes.response.status).toBe(404);
  });

  test("accepts repeat upsert (idempotent on same id)", async ({
    api,
    workspace,
  }) => {
    const providerId = uuidv4();
    const name = `sp-idem-${faker.string.alphanumeric(8)}`;

    const first = await api.PUT(
      "/v1/workspaces/{workspaceId}/secret-providers/{providerId}",
      {
        params: { path: { workspaceId: workspace.id, providerId } },
        body: {
          name,
          type: "aws_secrets_manager",
          config: { region: "us-east-1" },
        },
      },
    );

    try {
      expect(first.response.status).toBe(202);

      const second = await api.PUT(
        "/v1/workspaces/{workspaceId}/secret-providers/{providerId}",
        {
          params: { path: { workspaceId: workspace.id, providerId } },
          body: {
            name,
            type: "aws_secrets_manager",
            config: { region: "us-west-2" },
          },
        },
      );

      expect(second.response.status).toBe(202);

      const getRes = await api.GET(
        "/v1/workspaces/{workspaceId}/secret-providers/{providerId}",
        {
          params: { path: { workspaceId: workspace.id, providerId } },
        },
      );

      expect(getRes.response.status).toBe(200);
      expect(getRes.data!.name).toBe(name);
      expect(getRes.data!.type).toBe("aws_secrets_manager");
    } finally {
      await api.DELETE(
        "/v1/workspaces/{workspaceId}/secret-providers/{providerId}",
        {
          params: { path: { workspaceId: workspace.id, providerId } },
        },
      );
    }
  });

  test("rejects env provider with empty allowlist", async ({
    api,
    workspace,
  }) => {
    const providerId = uuidv4();
    const upsertRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/secret-providers/{providerId}",
      {
        params: { path: { workspaceId: workspace.id, providerId } },
        // Body fails OpenAPI minItems validation before reaching the handler.
        body: {
          name: `sp-bad-${faker.string.alphanumeric(8)}`,
          type: "env",
          // @ts-expect-error intentionally invalid for the test
          config: { allowedKeys: [] },
        },
      },
    );

    expect(upsertRes.response.status).toBe(400);
  });

  test("rejects doppler provider with malformed token", async ({
    api,
    workspace,
  }) => {
    const providerId = uuidv4();
    const upsertRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/secret-providers/{providerId}",
      {
        params: { path: { workspaceId: workspace.id, providerId } },
        body: {
          name: `sp-bad-${faker.string.alphanumeric(8)}`,
          type: "doppler",
          // Doesn't start with dp.st. - Zod discriminator rejects.
          config: { serviceToken: "not-a-doppler-token" },
        },
      },
    );

    expect(upsertRes.response.status).toBe(400);
  });
});
