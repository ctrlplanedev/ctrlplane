import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import { test } from "../fixtures";

test.describe("Release Target Eligible Versions API", () => {
  let systemId: string;
  let deploymentId: string;
  let environmentId: string;
  let resourceId: string;
  let releaseTargetKey: string;

  test.beforeAll(async ({ api, workspace }) => {
    const systemRes = await api.POST("/v1/workspaces/{workspaceId}/systems", {
      params: { path: { workspaceId: workspace.id } },
      body: { name: `evt-system-${faker.string.alphanumeric(8)}` },
    });
    expect(systemRes.response.status).toBe(202);
    systemId = systemRes.data!.id;

    const depName = `evt-dep-${faker.string.alphanumeric(8)}`;
    const depRes = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name: depName, slug: depName },
      },
    );
    expect(depRes.response.status).toBe(202);
    deploymentId = depRes.data!.id;
    await api.PUT(
      "/v1/workspaces/{workspaceId}/systems/{systemId}/deployments/{deploymentId}",
      {
        params: {
          path: { workspaceId: workspace.id, systemId, deploymentId },
        },
      },
    );

    const envRes = await api.POST(
      "/v1/workspaces/{workspaceId}/environments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name: `evt-env-${faker.string.alphanumeric(8)}` },
      },
    );
    expect(envRes.response.status).toBe(202);
    environmentId = envRes.data!.id;
    await api.PUT(
      "/v1/workspaces/{workspaceId}/systems/{systemId}/environments/{environmentId}",
      {
        params: {
          path: { workspaceId: workspace.id, systemId, environmentId },
        },
      },
    );

    const identifier = `evt-res-${faker.string.alphanumeric(8)}`;
    const putRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: { path: { workspaceId: workspace.id, identifier } },
        body: {
          name: identifier,
          kind: "TestKind",
          version: "1.0.0",
          config: {},
          metadata: {},
        },
      },
    );
    expect(putRes.response.status).toBe(202);

    const getResourceRes = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      { params: { path: { workspaceId: workspace.id, identifier } } },
    );
    expect(getResourceRes.response.status).toBe(200);
    resourceId = getResourceRes.data!.id;

    // Bypass reconciliation: insert computed_*_resource link rows directly so
    // the (resource, environment, deployment) triple is a valid release target
    // without waiting on the workspace-engine to fan things out.
    const now = new Date();
    await db
      .insert(schema.computedDeploymentResource)
      .values({ deploymentId, resourceId, lastEvaluatedAt: now });
    await db
      .insert(schema.computedEnvironmentResource)
      .values({ environmentId, resourceId, lastEvaluatedAt: now });

    releaseTargetKey = `${resourceId}-${environmentId}-${deploymentId}`;
  });

  test.afterAll(async ({ api, workspace }) => {
    // FK cascade from deployment → deployment_version was dropped in migration
    // 0139 (see deployment-version-list.spec.ts), so versions need explicit
    // delete before the deployment goes.
    await db
      .delete(schema.deploymentVersion)
      .where(eq(schema.deploymentVersion.deploymentId, deploymentId));

    await api.DELETE("/v1/workspaces/{workspaceId}/systems/{systemId}", {
      params: { path: { workspaceId: workspace.id, systemId } },
    });
  });

  test.afterEach(async () => {
    await db
      .delete(schema.deploymentVersion)
      .where(eq(schema.deploymentVersion.deploymentId, deploymentId));
  });

  const insertVersions = async (
    workspaceId: string,
    versions: { tag: string }[],
  ) => {
    const baseTime = Date.now();
    await db.insert(schema.deploymentVersion).values(
      versions.map((v, i) => ({
        name: v.tag,
        tag: v.tag,
        deploymentId,
        workspaceId,
        createdAt: new Date(baseTime + i * 1000),
      })),
    );
  };

  test("returns all versions when no policies block", async ({
    api,
    workspace,
  }) => {
    await insertVersions(workspace.id, [
      { tag: "v1.0.0" },
      { tag: "v1.1.0" },
      { tag: "v2.0.0" },
    ]);

    const res = await api.POST(
      "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/eligible-versions",
      {
        params: { path: { workspaceId: workspace.id, releaseTargetKey } },
        body: {},
      },
    );

    expect(res.response.status).toBe(200);
    expect(res.data!.total).toBe(3);
    expect(res.data!.items.map((v) => v.tag).sort()).toEqual([
      "v1.0.0",
      "v1.1.0",
      "v2.0.0",
    ]);
  });

  test("excludes versions blocked by a versionSelector policy", async ({
    api,
    workspace,
  }) => {
    await insertVersions(workspace.id, [
      { tag: "v1.0.0" },
      { tag: "v1.1.0" },
      { tag: "v2.0.0" },
    ]);

    const policyRes = await api.POST(
      "/v1/workspaces/{workspaceId}/policies",
      {
        params: { path: { workspaceId: workspace.id } },
        body: {
          name: `evt-policy-${faker.string.alphanumeric(8)}`,
          selector: "true",
          rules: [
            {
              versionSelector: {
                selector: 'version.tag.startsWith("v1.")',
                description: "v1.x only",
              },
            },
          ],
        },
      },
    );
    expect(policyRes.response.status).toBe(202);
    const policyId = policyRes.data!.id;

    try {
      const res = await api.POST(
        "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/eligible-versions",
        {
          params: { path: { workspaceId: workspace.id, releaseTargetKey } },
          body: {},
        },
      );

      expect(res.response.status).toBe(200);
      expect(res.data!.total).toBe(2);
      expect(res.data!.items.map((v) => v.tag).sort()).toEqual([
        "v1.0.0",
        "v1.1.0",
      ]);
    } finally {
      await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
        params: { path: { workspaceId: workspace.id, policyId } },
      });
    }
  });

  test("excludeRuleIds bypasses a versionSelector pin, returning all versions", async ({
    api,
    workspace,
  }) => {
    await insertVersions(workspace.id, [
      { tag: "v1.0.0" },
      { tag: "v1.1.0" },
      { tag: "v2.0.0" },
    ]);

    const policyRes = await api.POST(
      "/v1/workspaces/{workspaceId}/policies",
      {
        params: { path: { workspaceId: workspace.id } },
        body: {
          name: `evt-pin-${faker.string.alphanumeric(8)}`,
          selector: "true",
          rules: [
            {
              versionSelector: {
                selector: 'version.tag == "v2.0.0"',
                description: "pin to v2.0.0",
              },
            },
          ],
        },
      },
    );
    expect(policyRes.response.status).toBe(202);
    const policyId = policyRes.data!.id;
    const ruleId = policyRes.data!.rules[0]!.id;

    try {
      const pinned = await api.POST(
        "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/eligible-versions",
        {
          params: { path: { workspaceId: workspace.id, releaseTargetKey } },
          body: {},
        },
      );
      expect(pinned.response.status).toBe(200);
      expect(pinned.data!.total).toBe(1);
      expect(pinned.data!.items.map((v) => v.tag)).toEqual(["v2.0.0"]);

      const unpinned = await api.POST(
        "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/eligible-versions",
        {
          params: { path: { workspaceId: workspace.id, releaseTargetKey } },
          body: { excludeRuleIds: [ruleId] },
        },
      );
      expect(unpinned.response.status).toBe(200);
      expect(unpinned.data!.total).toBe(3);
      expect(unpinned.data!.items.map((v) => v.tag).sort()).toEqual([
        "v1.0.0",
        "v1.1.0",
        "v2.0.0",
      ]);
    } finally {
      await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
        params: { path: { workspaceId: workspace.id, policyId } },
      });
    }
  });

  test("CEL filter narrows the eligible set", async ({ api, workspace }) => {
    await insertVersions(workspace.id, [
      { tag: "v1.0.0" },
      { tag: "v1.1.0" },
      { tag: "v2.0.0" },
    ]);

    const res = await api.POST(
      "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/eligible-versions",
      {
        params: { path: { workspaceId: workspace.id, releaseTargetKey } },
        body: { filter: 'version.tag.startsWith("v1.")' },
      },
    );

    expect(res.response.status).toBe(200);
    expect(res.data!.total).toBe(2);
    expect(res.data!.items.map((v) => v.tag).sort()).toEqual([
      "v1.0.0",
      "v1.1.0",
    ]);
  });

  test("pagination slices the filtered set, total reflects full count", async ({
    api,
    workspace,
  }) => {
    await insertVersions(
      workspace.id,
      Array.from({ length: 5 }, (_, i) => ({ tag: `v1.0.${i}` })),
    );

    const res = await api.POST(
      "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/eligible-versions",
      {
        params: {
          path: { workspaceId: workspace.id, releaseTargetKey },
          query: { limit: 2, offset: 2 },
        },
        body: {},
      },
    );

    expect(res.response.status).toBe(200);
    expect(res.data!.total).toBe(5);
    expect(res.data!.limit).toBe(2);
    expect(res.data!.offset).toBe(2);
    expect(res.data!.items).toHaveLength(2);
  });

  test("returns 404 for a non-existent release target", async ({
    api,
    workspace,
  }) => {
    const fakeKey = `${faker.string.uuid()}-${faker.string.uuid()}-${faker.string.uuid()}`;
    const res = await api.POST(
      "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/eligible-versions",
      {
        params: {
          path: { workspaceId: workspace.id, releaseTargetKey: fakeKey },
        },
        body: {},
      },
    );

    expect(res.response.status).toBe(404);
  });

  test("returns 400 for a malformed CEL filter", async ({ api, workspace }) => {
    const res = await api.POST(
      "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/eligible-versions",
      {
        params: { path: { workspaceId: workspace.id, releaseTargetKey } },
        body: { filter: "this is not cel @#$%" },
      },
    );

    expect(res.response.status).toBe(400);
  });
});
