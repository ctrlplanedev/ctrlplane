import { expect } from "@playwright/test";
import { faker } from "@faker-js/faker";

import { test } from "../fixtures";

test.describe("Deployment Version Dependencies API", () => {
  let systemId: string;
  let downstreamId: string;
  let upstreamId: string;
  let secondUpstreamId: string;

  test.beforeAll(async ({ api, workspace }) => {
    const systemRes = await api.POST(
      "/v1/workspaces/{workspaceId}/systems",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name: `dep-test-system-${faker.string.alphanumeric(8)}` },
      },
    );
    expect(systemRes.response.status).toBe(202);
    systemId = systemRes.data!.id;

    const downstreamName = `downstream-${faker.string.alphanumeric(8)}`;
    const downstreamRes = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name: downstreamName, slug: downstreamName },
      },
    );
    expect(downstreamRes.response.status).toBe(202);
    downstreamId = downstreamRes.data!.id;

    const upstreamName = `upstream-${faker.string.alphanumeric(8)}`;
    const upstreamRes = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name: upstreamName, slug: upstreamName },
      },
    );
    expect(upstreamRes.response.status).toBe(202);
    upstreamId = upstreamRes.data!.id;

    const secondUpstreamName = `upstream2-${faker.string.alphanumeric(8)}`;
    const secondUpstreamRes = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: {
          name: secondUpstreamName,
          slug: secondUpstreamName,
        },
      },
    );
    expect(secondUpstreamRes.response.status).toBe(202);
    secondUpstreamId = secondUpstreamRes.data!.id;
  });

  test.afterAll(async ({ api, workspace }) => {
    await api.DELETE("/v1/workspaces/{workspaceId}/systems/{systemId}", {
      params: { path: { workspaceId: workspace.id, systemId } },
    });
    for (const id of [downstreamId, upstreamId, secondUpstreamId]) {
      await api.DELETE(
        "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
        {
          params: { path: { workspaceId: workspace.id, deploymentId: id } },
        },
      );
    }
  });

  // --------------------------------------------------------------------------
  // Inline dependencies on version create
  // --------------------------------------------------------------------------

  test("creates a version with no dependencies (regression)", async ({
    api,
    workspace,
  }) => {
    const tag = `v-no-deps-${faker.string.alphanumeric(6)}`;
    const res = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId: downstreamId },
        },
        body: { name: tag, tag, status: "ready" },
      },
    );
    expect(res.response.status).toBe(200);

    const listRes = await api.GET(
      "/v1/workspaces/{workspaceId}/deployment-versions/{deploymentVersionId}/dependencies",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            deploymentVersionId: res.data!.id,
          },
        },
      },
    );
    expect(listRes.response.status).toBe(200);
    expect(listRes.data).toEqual([]);
  });

  test("creates a version with inline dependencies (atomic)", async ({
    api,
    workspace,
  }) => {
    const tag = `v-with-deps-${faker.string.alphanumeric(6)}`;
    const res = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId: downstreamId },
        },
        body: {
          name: tag,
          tag,
          status: "ready",
          dependencies: {
            [upstreamId]: { versionSelector: `version.tag == "v2.0.0"` },
            [secondUpstreamId]: { versionSelector: `true` },
          },
        },
      },
    );
    expect(res.response.status).toBe(200);

    const listRes = await api.GET(
      "/v1/workspaces/{workspaceId}/deployment-versions/{deploymentVersionId}/dependencies",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            deploymentVersionId: res.data!.id,
          },
        },
      },
    );
    expect(listRes.response.status).toBe(200);
    expect(listRes.data).toHaveLength(2);

    const byDep = new Map(
      (listRes.data ?? []).map((edge) => [edge.dependencyDeploymentId, edge]),
    );
    expect(byDep.get(upstreamId)?.versionSelector).toBe(
      `version.tag == "v2.0.0"`,
    );
    expect(byDep.get(secondUpstreamId)?.versionSelector).toBe(`true`);
  });

  test("rejects self-dependency on version create", async ({
    api,
    workspace,
  }) => {
    const tag = `v-self-${faker.string.alphanumeric(6)}`;
    const res = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId: downstreamId },
        },
        body: {
          name: tag,
          tag,
          status: "ready",
          dependencies: {
            [downstreamId]: { versionSelector: `true` },
          },
        },
      },
    );
    expect(res.response.status).toBe(400);
  });

  test("rejects invalid CEL selector on version create", async ({
    api,
    workspace,
  }) => {
    const tag = `v-bad-cel-${faker.string.alphanumeric(6)}`;
    const res = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId: downstreamId },
        },
        body: {
          name: tag,
          tag,
          status: "ready",
          dependencies: {
            [upstreamId]: { versionSelector: `((( not valid cel` },
          },
        },
      },
    );
    expect(res.response.status).toBe(400);
  });

  test("rejects dependency on a deployment that doesn't exist in this workspace", async ({
    api,
    workspace,
  }) => {
    const tag = `v-missing-dep-${faker.string.alphanumeric(6)}`;
    const fakeDepId = faker.string.uuid();
    const res = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId: downstreamId },
        },
        body: {
          name: tag,
          tag,
          status: "ready",
          dependencies: {
            [fakeDepId]: { versionSelector: `true` },
          },
        },
      },
    );
    expect(res.response.status).toBe(404);
  });

  test("does not create the version when dependency validation fails", async ({
    api,
    workspace,
  }) => {
    const tag = `v-atomic-fail-${faker.string.alphanumeric(6)}`;
    const fakeDepId = faker.string.uuid();
    const failRes = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId: downstreamId },
        },
        body: {
          name: tag,
          tag,
          status: "ready",
          dependencies: {
            [fakeDepId]: { versionSelector: `true` },
          },
        },
      },
    );
    expect(failRes.response.status).toBe(404);

    // The version with this tag must not exist — re-creating it with the
    // same tag must succeed (i.e., no row was leaked from the failed call).
    const retryRes = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId: downstreamId },
        },
        body: { name: tag, tag, status: "ready" },
      },
    );
    expect(retryRes.response.status).toBe(200);
  });

  // --------------------------------------------------------------------------
  // PUT upsert endpoint
  // --------------------------------------------------------------------------

  test("upserts a dependency edge on an existing version", async ({
    api,
    workspace,
  }) => {
    const tag = `v-put-${faker.string.alphanumeric(6)}`;
    const versionRes = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId: downstreamId },
        },
        body: { name: tag, tag, status: "ready" },
      },
    );
    expect(versionRes.response.status).toBe(200);
    const deploymentVersionId = versionRes.data!.id;

    // Create
    const createRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/deployment-versions/{deploymentVersionId}/dependencies/{dependencyDeploymentId}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            deploymentVersionId,
            dependencyDeploymentId: upstreamId,
          },
        },
        body: { versionSelector: `version.tag == "v1.0.0"` },
      },
    );
    expect(createRes.response.status).toBe(202);

    // Update (same edge, new selector)
    const updateRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/deployment-versions/{deploymentVersionId}/dependencies/{dependencyDeploymentId}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            deploymentVersionId,
            dependencyDeploymentId: upstreamId,
          },
        },
        body: { versionSelector: `version.tag == "v2.0.0"` },
      },
    );
    expect(updateRes.response.status).toBe(202);

    const listRes = await api.GET(
      "/v1/workspaces/{workspaceId}/deployment-versions/{deploymentVersionId}/dependencies",
      {
        params: { path: { workspaceId: workspace.id, deploymentVersionId } },
      },
    );
    expect(listRes.response.status).toBe(200);
    expect(listRes.data).toHaveLength(1);
    expect(listRes.data![0].versionSelector).toBe(`version.tag == "v2.0.0"`);
  });

  test("rejects upsert with invalid CEL selector", async ({
    api,
    workspace,
  }) => {
    const tag = `v-put-bad-cel-${faker.string.alphanumeric(6)}`;
    const versionRes = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId: downstreamId },
        },
        body: { name: tag, tag, status: "ready" },
      },
    );
    const deploymentVersionId = versionRes.data!.id;

    const res = await api.PUT(
      "/v1/workspaces/{workspaceId}/deployment-versions/{deploymentVersionId}/dependencies/{dependencyDeploymentId}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            deploymentVersionId,
            dependencyDeploymentId: upstreamId,
          },
        },
        body: { versionSelector: `((( not valid cel` },
      },
    );
    expect(res.response.status).toBe(400);
  });

  test("rejects upsert with self-dependency (version's own deployment)", async ({
    api,
    workspace,
  }) => {
    const tag = `v-put-self-${faker.string.alphanumeric(6)}`;
    const versionRes = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId: downstreamId },
        },
        body: { name: tag, tag, status: "ready" },
      },
    );
    const deploymentVersionId = versionRes.data!.id;

    const res = await api.PUT(
      "/v1/workspaces/{workspaceId}/deployment-versions/{deploymentVersionId}/dependencies/{dependencyDeploymentId}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            deploymentVersionId,
            dependencyDeploymentId: downstreamId,
          },
        },
        body: { versionSelector: `true` },
      },
    );
    expect(res.response.status).toBe(400);
  });

  test("rejects upsert when version does not exist in workspace", async ({
    api,
    workspace,
  }) => {
    const res = await api.PUT(
      "/v1/workspaces/{workspaceId}/deployment-versions/{deploymentVersionId}/dependencies/{dependencyDeploymentId}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            deploymentVersionId: faker.string.uuid(),
            dependencyDeploymentId: upstreamId,
          },
        },
        body: { versionSelector: `true` },
      },
    );
    expect(res.response.status).toBe(404);
  });

  test("rejects upsert when dependency deployment does not exist in workspace", async ({
    api,
    workspace,
  }) => {
    const tag = `v-put-missing-dep-${faker.string.alphanumeric(6)}`;
    const versionRes = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId: downstreamId },
        },
        body: { name: tag, tag, status: "ready" },
      },
    );
    const deploymentVersionId = versionRes.data!.id;

    const res = await api.PUT(
      "/v1/workspaces/{workspaceId}/deployment-versions/{deploymentVersionId}/dependencies/{dependencyDeploymentId}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            deploymentVersionId,
            dependencyDeploymentId: faker.string.uuid(),
          },
        },
        body: { versionSelector: `true` },
      },
    );
    expect(res.response.status).toBe(404);
  });

  // --------------------------------------------------------------------------
  // GET list endpoint
  // --------------------------------------------------------------------------

  test("returns 404 listing dependencies for a version that doesn't exist", async ({
    api,
    workspace,
  }) => {
    const res = await api.GET(
      "/v1/workspaces/{workspaceId}/deployment-versions/{deploymentVersionId}/dependencies",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            deploymentVersionId: faker.string.uuid(),
          },
        },
      },
    );
    expect(res.response.status).toBe(404);
  });

  test("lists dependencies sorted by dependencyDeploymentId", async ({
    api,
    workspace,
  }) => {
    const tag = `v-list-${faker.string.alphanumeric(6)}`;
    const versionRes = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId: downstreamId },
        },
        body: {
          name: tag,
          tag,
          status: "ready",
          dependencies: {
            [upstreamId]: { versionSelector: `version.tag.startsWith("v1")` },
            [secondUpstreamId]: { versionSelector: `true` },
          },
        },
      },
    );
    expect(versionRes.response.status).toBe(200);

    const listRes = await api.GET(
      "/v1/workspaces/{workspaceId}/deployment-versions/{deploymentVersionId}/dependencies",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            deploymentVersionId: versionRes.data!.id,
          },
        },
      },
    );
    expect(listRes.response.status).toBe(200);
    const ids = (listRes.data ?? []).map((e) => e.dependencyDeploymentId);
    expect(ids).toEqual([...ids].sort());
    expect(ids).toContain(upstreamId);
    expect(ids).toContain(secondUpstreamId);
  });

  // --------------------------------------------------------------------------
  // DELETE endpoint
  // --------------------------------------------------------------------------

  test("deletes a dependency edge", async ({ api, workspace }) => {
    const tag = `v-delete-${faker.string.alphanumeric(6)}`;
    const versionRes = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId: downstreamId },
        },
        body: {
          name: tag,
          tag,
          status: "ready",
          dependencies: {
            [upstreamId]: { versionSelector: `true` },
          },
        },
      },
    );
    const deploymentVersionId = versionRes.data!.id;

    const deleteRes = await api.DELETE(
      "/v1/workspaces/{workspaceId}/deployment-versions/{deploymentVersionId}/dependencies/{dependencyDeploymentId}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            deploymentVersionId,
            dependencyDeploymentId: upstreamId,
          },
        },
      },
    );
    expect(deleteRes.response.status).toBe(202);

    const listRes = await api.GET(
      "/v1/workspaces/{workspaceId}/deployment-versions/{deploymentVersionId}/dependencies",
      {
        params: { path: { workspaceId: workspace.id, deploymentVersionId } },
      },
    );
    expect(listRes.response.status).toBe(200);
    expect(listRes.data).toEqual([]);
  });

  test("returns 404 when deleting a non-existent edge", async ({
    api,
    workspace,
  }) => {
    const tag = `v-delete-missing-${faker.string.alphanumeric(6)}`;
    const versionRes = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId: downstreamId },
        },
        body: { name: tag, tag, status: "ready" },
      },
    );
    const deploymentVersionId = versionRes.data!.id;

    const res = await api.DELETE(
      "/v1/workspaces/{workspaceId}/deployment-versions/{deploymentVersionId}/dependencies/{dependencyDeploymentId}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            deploymentVersionId,
            dependencyDeploymentId: upstreamId,
          },
        },
      },
    );
    expect(res.response.status).toBe(404);
  });

  test("returns 404 when deleting an edge on a non-existent version", async ({
    api,
    workspace,
  }) => {
    const res = await api.DELETE(
      "/v1/workspaces/{workspaceId}/deployment-versions/{deploymentVersionId}/dependencies/{dependencyDeploymentId}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            deploymentVersionId: faker.string.uuid(),
            dependencyDeploymentId: upstreamId,
          },
        },
      },
    );
    expect(res.response.status).toBe(404);
  });
});
