import { expect } from "@playwright/test";
import { faker } from "@faker-js/faker";

import { inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { ApiClient } from "../../api";
import { test } from "../fixtures";

test.describe("Deployment Version List API (CEL paging)", () => {
  let systemId: string;
  const deploymentIds: string[] = [];

  test.beforeAll(async ({ api, workspace }) => {
    const systemRes = await api.POST(
      "/v1/workspaces/{workspaceId}/systems",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name: `ver-list-system-${faker.string.alphanumeric(8)}` },
      },
    );
    expect(systemRes.response.status).toBe(202);
    systemId = systemRes.data!.id;
  });

  test.afterAll(async ({ api, workspace }) => {
    // FK cascade from deployment → deployment_version was dropped in migration
    // 0139, so versions inserted directly must be deleted explicitly before
    // their owning deployment.
    if (deploymentIds.length > 0) {
      await db
        .delete(schema.deploymentVersion)
        .where(inArray(schema.deploymentVersion.deploymentId, deploymentIds));

      for (const deploymentId of deploymentIds) {
        await api.DELETE(
          "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
          { params: { path: { workspaceId: workspace.id, deploymentId } } },
        );
      }
    }

    await api.DELETE("/v1/workspaces/{workspaceId}/systems/{systemId}", {
      params: { path: { workspaceId: workspace.id, systemId } },
    });
  });

  const createDeployment = async (
    api: ApiClient,
    workspaceId: string,
    name: string,
  ): Promise<string> => {
    const res = await api.POST("/v1/workspaces/{workspaceId}/deployments", {
      params: { path: { workspaceId } },
      body: { name, slug: name },
    });
    expect(res.response.status).toBe(202);
    const id = res.data!.id;
    deploymentIds.push(id);
    return id;
  };

  test("respects limit and reports true total across multi-batch CEL scan", async ({
    api,
    workspace,
  }) => {
    test.skip(
      !process.env.RUN_HEAVY_TESTS,
      "Inserts 1500 versions to exercise the endpoint's multi-batch path. Opt in with RUN_HEAVY_TESTS=1.",
    );

    const suffix = faker.string.alphanumeric(8);
    const deploymentId = await createDeployment(
      api,
      workspace.id,
      `vl-multibatch-${suffix}`,
    );

    // 1500 versions > the endpoint's internal batch size (500), so the helper
    // must iterate multiple batches. Even indices match → 750 matches total.
    const start = Date.now() - 1500 * 1000;
    const rows = Array.from({ length: 1500 }, (_, i) => ({
      name: `${suffix}-${String(i).padStart(4, "0")}`,
      tag: `${suffix}-${String(i).padStart(4, "0")}`,
      deploymentId,
      workspaceId: workspace.id,
      createdAt: new Date(start + i * 1000),
      metadata: { batch: suffix, match: i % 2 === 0 ? "yes" : "no" },
    }));
    await db.insert(schema.deploymentVersion).values(rows);

    const res = await api.GET(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId },
          query: {
            cel: `version.metadata.match == "yes"`,
            limit: 10,
            offset: 0,
            order: "asc",
          },
        },
      },
    );

    expect(res.response.status).toBe(200);
    expect(res.data!.total).toBe(750);
    expect(res.data!.items).toHaveLength(10);
    expect(res.data!.items.map((v) => v.tag)).toEqual(
      Array.from({ length: 10 }, (_, k) =>
        `${suffix}-${String(k * 2).padStart(4, "0")}`,
      ),
    );
  });

  test("paginates by offset across multi-batch CEL scan", async ({
    api,
    workspace,
  }) => {
    test.skip(
      !process.env.RUN_HEAVY_TESTS,
      "Inserts 1500 versions to exercise the endpoint's multi-batch path. Opt in with RUN_HEAVY_TESTS=1.",
    );

    const suffix = faker.string.alphanumeric(8);
    const deploymentId = await createDeployment(
      api,
      workspace.id,
      `vl-pagin-${suffix}`,
    );

    // 1500 versions; odd indices match → 750 matches.
    const start = Date.now() - 1500 * 1000;
    const rows = Array.from({ length: 1500 }, (_, i) => ({
      name: `${suffix}-${String(i).padStart(4, "0")}`,
      tag: `${suffix}-${String(i).padStart(4, "0")}`,
      deploymentId,
      workspaceId: workspace.id,
      createdAt: new Date(start + i * 1000),
      metadata: { batch: suffix, match: i % 2 === 1 ? "yes" : "no" },
    }));
    await db.insert(schema.deploymentVersion).values(rows);

    // Offset deep enough that the page lands past the first internal batch.
    const res = await api.GET(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId },
          query: {
            cel: `version.metadata.match == "yes"`,
            limit: 10,
            offset: 740,
            order: "asc",
          },
        },
      },
    );

    expect(res.response.status).toBe(200);
    expect(res.data!.total).toBe(750);
    expect(res.data!.items).toHaveLength(10);
    // Match #k (0-indexed) is source index 2k+1; page starts at match #740.
    expect(res.data!.items.map((v) => v.tag)).toEqual(
      Array.from({ length: 10 }, (_, k) =>
        `${suffix}-${String((740 + k) * 2 + 1).padStart(4, "0")}`,
      ),
    );
  });

  test("CEL: returns all matches when limit exceeds match count", async ({
    api,
    workspace,
  }) => {
    const suffix = faker.string.alphanumeric(8);
    const deploymentId = await createDeployment(
      api,
      workspace.id,
      `vl-fewer-${suffix}`,
    );

    const start = Date.now() - 100 * 1000;
    const rows = Array.from({ length: 100 }, (_, i) => ({
      name: `${suffix}-${i}`,
      tag: `${suffix}-${i}`,
      deploymentId,
      workspaceId: workspace.id,
      createdAt: new Date(start + i * 1000),
      metadata: { batch: suffix, special: i < 5 ? "yes" : "no" },
    }));
    await db.insert(schema.deploymentVersion).values(rows);

    const res = await api.GET(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId },
          query: {
            cel: `version.metadata.special == "yes"`,
            limit: 20,
            offset: 0,
          },
        },
      },
    );

    expect(res.response.status).toBe(200);
    expect(res.data!.items).toHaveLength(5);
    expect(res.data!.total).toBe(5);
  });

  test("CEL: returns empty when nothing matches", async ({
    api,
    workspace,
  }) => {
    const suffix = faker.string.alphanumeric(8);
    const deploymentId = await createDeployment(
      api,
      workspace.id,
      `vl-empty-${suffix}`,
    );

    const rows = Array.from({ length: 10 }, (_, i) => ({
      name: `${suffix}-${i}`,
      tag: `${suffix}-${i}`,
      deploymentId,
      workspaceId: workspace.id,
      createdAt: new Date(Date.now() + i * 1000),
      metadata: { batch: suffix },
    }));
    await db.insert(schema.deploymentVersion).values(rows);

    const res = await api.GET(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId },
          query: {
            cel: `version.metadata.nonexistent == "x"`,
          },
        },
      },
    );

    expect(res.response.status).toBe(200);
    expect(res.data!.items).toEqual([]);
    expect(res.data!.total).toBe(0);
  });

  test("CEL: default order is desc by createdAt", async ({
    api,
    workspace,
  }) => {
    const suffix = faker.string.alphanumeric(8);
    const deploymentId = await createDeployment(
      api,
      workspace.id,
      `vl-desc-${suffix}`,
    );

    const start = Date.now() - 20 * 1000;
    const rows = Array.from({ length: 20 }, (_, i) => ({
      name: `${suffix}-${String(i).padStart(2, "0")}`,
      tag: `${suffix}-${String(i).padStart(2, "0")}`,
      deploymentId,
      workspaceId: workspace.id,
      createdAt: new Date(start + i * 1000),
      metadata: { batch: suffix, match: "yes" },
    }));
    await db.insert(schema.deploymentVersion).values(rows);

    const res = await api.GET(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId },
          query: {
            cel: `version.metadata.match == "yes"`,
            limit: 3,
          },
        },
      },
    );

    expect(res.response.status).toBe(200);
    expect(res.data!.items.map((v) => v.tag)).toEqual([
      `${suffix}-19`,
      `${suffix}-18`,
      `${suffix}-17`,
    ]);
  });

  test("CEL: order=asc returns earliest matches first", async ({
    api,
    workspace,
  }) => {
    const suffix = faker.string.alphanumeric(8);
    const deploymentId = await createDeployment(
      api,
      workspace.id,
      `vl-asc-${suffix}`,
    );

    const start = Date.now() - 20 * 1000;
    const rows = Array.from({ length: 20 }, (_, i) => ({
      name: `${suffix}-${String(i).padStart(2, "0")}`,
      tag: `${suffix}-${String(i).padStart(2, "0")}`,
      deploymentId,
      workspaceId: workspace.id,
      createdAt: new Date(start + i * 1000),
      metadata: { batch: suffix, match: "yes" },
    }));
    await db.insert(schema.deploymentVersion).values(rows);

    const res = await api.GET(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId },
          query: {
            cel: `version.metadata.match == "yes"`,
            limit: 3,
            order: "asc",
          },
        },
      },
    );

    expect(res.response.status).toBe(200);
    expect(res.data!.items.map((v) => v.tag)).toEqual([
      `${suffix}-00`,
      `${suffix}-01`,
      `${suffix}-02`,
    ]);
  });

  test("returns 400 for invalid CEL", async ({ api, workspace }) => {
    const suffix = faker.string.alphanumeric(8);
    const deploymentId = await createDeployment(
      api,
      workspace.id,
      `vl-invalid-${suffix}`,
    );

    const res = await api.GET(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId },
          query: { cel: "this is (((not valid CEL" },
        },
      },
    );

    expect(res.response.status).toBe(400);
  });

  test("non-CEL list respects limit, offset, and total", async ({
    api,
    workspace,
  }) => {
    const suffix = faker.string.alphanumeric(8);
    const deploymentId = await createDeployment(
      api,
      workspace.id,
      `vl-nocel-${suffix}`,
    );

    const start = Date.now() - 10 * 1000;
    const rows = Array.from({ length: 10 }, (_, i) => ({
      name: `${suffix}-${i}`,
      tag: `${suffix}-${i}`,
      deploymentId,
      workspaceId: workspace.id,
      createdAt: new Date(start + i * 1000),
    }));
    await db.insert(schema.deploymentVersion).values(rows);

    const res = await api.GET(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId },
          query: { limit: 3, offset: 2 },
        },
      },
    );

    expect(res.response.status).toBe(200);
    expect(res.data!.items).toHaveLength(3);
    expect(res.data!.total).toBe(10);
    expect(res.data!.limit).toBe(3);
    expect(res.data!.offset).toBe(2);
  });

  test("CEL filter does not leak versions from sibling deployments", async ({
    api,
    workspace,
  }) => {
    const suffix = faker.string.alphanumeric(8);
    const deployA = await createDeployment(
      api,
      workspace.id,
      `vl-a-${suffix}`,
    );
    const deployB = await createDeployment(
      api,
      workspace.id,
      `vl-b-${suffix}`,
    );

    const start = Date.now() - 10 * 1000;
    const buildRows = (deploymentId: string, label: string) =>
      Array.from({ length: 5 }, (_, i) => ({
        name: `${suffix}-${label}-${i}`,
        tag: `${suffix}-${label}-${i}`,
        deploymentId,
        workspaceId: workspace.id,
        createdAt: new Date(start + i * 1000),
        metadata: { batch: suffix },
      }));
    await db
      .insert(schema.deploymentVersion)
      .values([...buildRows(deployA, "a"), ...buildRows(deployB, "b")]);

    const res = await api.GET(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId: deployA },
          query: { cel: `version.metadata.batch == "${suffix}"` },
        },
      },
    );

    expect(res.response.status).toBe(200);
    expect(res.data!.total).toBe(5);
    expect(res.data!.items.every((v) => v.tag.includes(`-a-`))).toBe(true);
  });
});
