import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { cleanupImportedEntities, EntitiesBuilder } from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "release-target-lock.spec.yaml");

test.describe("Release Target Lock API", () => {
  let builder: EntitiesBuilder;

  test.beforeAll(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);
    await builder.upsertSystemFixture();
    await builder.upsertEnvironmentFixtures();
    await builder.upsertDeploymentFixtures();
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.refs, workspace.id);
  });

  test("should lock a release target", async ({ api, page, workspace }) => {
    const prefix = builder.refs.prefix;
    const resourceName = `${faker.string.alphanumeric(10)}-${prefix}`;
    const resourceResponse = await api.POST("/v1/resources", {
      body: {
        name: resourceName,
        kind: "service",
        identifier: resourceName,
        version: "1.0.0",
        config: {},
        workspaceId: workspace.id,
      },
    });
    expect(resourceResponse.response.status).toBe(200);
    expect(resourceResponse.data).toBeDefined();
    const resource = resourceResponse.data!;

    await page.waitForTimeout(5_000);

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: {
            resourceId: resource.id,
          },
        },
      },
    );
    expect(releaseTargetResponse.response.status).toBe(200);
    expect(releaseTargetResponse.data).toBeDefined();
    expect(releaseTargetResponse.data!.length).toBe(1);
    const releaseTarget = releaseTargetResponse.data!.at(0)!;

    const lockResponse = await api.POST(
      "/v1/release-targets/{releaseTargetId}/lock",
      {
        params: {
          path: { releaseTargetId: releaseTarget.id },
        },
      },
    );
    expect(lockResponse.response.status).toBe(200);
    expect(lockResponse.data).toBeDefined();
    const lock = lockResponse.data!;

    expect(lock.lockedAt).toBeDefined();
    expect(lock.unlockedAt).toBeNull();
    expect(lock.lockedBy).toBeDefined();

    const deployment = builder.refs.deployments.at(0)!;
    const tag = faker.string.alphanumeric(10);
    const deploymentVersionResponse = await api.POST(
      "/v1/deployment-versions",
      {
        body: {
          deploymentId: deployment.id,
          tag,
        },
      },
    );
    expect(deploymentVersionResponse.response.status).toBe(201);

    await page.waitForTimeout(5_000);

    const releaseResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      {
        params: {
          path: { releaseTargetId: releaseTarget.id },
        },
      },
    );
    expect(releaseResponse.response.status).toBe(200);
    const release = releaseResponse.data?.find((r) => r.version.tag === tag);
    expect(release).toBeUndefined();
  });

  test("should unlock a release target", async ({ api, page, workspace }) => {
    const prefix = builder.refs.prefix;
    const resourceName = `${faker.string.alphanumeric(10)}-${prefix}`;
    const resourceResponse = await api.POST("/v1/resources", {
      body: {
        name: resourceName,
        kind: "service",
        identifier: resourceName,
        version: "1.0.0",
        config: {},
        workspaceId: workspace.id,
      },
    });
    expect(resourceResponse.response.status).toBe(200);
    expect(resourceResponse.data).toBeDefined();
    const resource = resourceResponse.data!;

    await page.waitForTimeout(5_000);

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: {
            resourceId: resource.id,
          },
        },
      },
    );
    expect(releaseTargetResponse.response.status).toBe(200);
    expect(releaseTargetResponse.data).toBeDefined();
    expect(releaseTargetResponse.data!.length).toBe(1);
    const releaseTarget = releaseTargetResponse.data!.at(0)!;

    const lockResponse = await api.POST(
      "/v1/release-targets/{releaseTargetId}/lock",
      {
        params: {
          path: { releaseTargetId: releaseTarget.id },
        },
      },
    );
    expect(lockResponse.response.status).toBe(200);
    expect(lockResponse.data).toBeDefined();
    const lock = lockResponse.data!;

    expect(lock.lockedAt).toBeDefined();
    expect(lock.unlockedAt).toBeNull();
    expect(lock.lockedBy).toBeDefined();

    const deployment = builder.refs.deployments.at(0)!;
    const tag = faker.string.alphanumeric(10);
    const deploymentVersionResponse = await api.POST(
      "/v1/deployment-versions",
      {
        body: {
          deploymentId: deployment.id,
          tag,
        },
      },
    );
    expect(deploymentVersionResponse.response.status).toBe(201);

    const unlockResponse = await api.POST(
      "/v1/release-targets/{releaseTargetId}/unlock",
      {
        params: {
          path: { releaseTargetId: releaseTarget.id },
        },
      },
    );
    expect(unlockResponse.response.status).toBe(200);
    expect(unlockResponse.data).toBeDefined();
    const unlock = unlockResponse.data!;

    expect(unlock.unlockedAt).toBeDefined();

    await page.waitForTimeout(5_000);

    const releaseResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      {
        params: {
          path: { releaseTargetId: releaseTarget.id },
        },
      },
    );
    expect(releaseResponse.response.status).toBe(200);
    const release = releaseResponse.data?.find((r) => r.version.tag === tag);
    expect(release).toBeDefined();
  });

  test("should not lock a release target that is already locked", async ({
    api,
    page,
    workspace,
  }) => {
    const prefix = builder.refs.prefix;
    const resourceName = `${faker.string.alphanumeric(10)}-${prefix}`;
    const resourceResponse = await api.POST("/v1/resources", {
      body: {
        name: resourceName,
        kind: "service",
        identifier: resourceName,
        version: "1.0.0",
        config: {},
        workspaceId: workspace.id,
      },
    });
    expect(resourceResponse.response.status).toBe(200);
    expect(resourceResponse.data).toBeDefined();
    const resource = resourceResponse.data!;

    await page.waitForTimeout(5_000);

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: {
            resourceId: resource.id,
          },
        },
      },
    );
    expect(releaseTargetResponse.response.status).toBe(200);
    expect(releaseTargetResponse.data).toBeDefined();
    expect(releaseTargetResponse.data!.length).toBe(1);
    const releaseTarget = releaseTargetResponse.data!.at(0)!;

    const lockResponse = await api.POST(
      "/v1/release-targets/{releaseTargetId}/lock",
      {
        params: {
          path: { releaseTargetId: releaseTarget.id },
        },
      },
    );
    expect(lockResponse.response.status).toBe(200);
    expect(lockResponse.data).toBeDefined();
    const lock = lockResponse.data!;

    expect(lock.lockedAt).toBeDefined();
    expect(lock.unlockedAt).toBeNull();
    expect(lock.lockedBy).toBeDefined();

    const lockResponse2 = await api.POST(
      "/v1/release-targets/{releaseTargetId}/lock",
      {
        params: {
          path: { releaseTargetId: releaseTarget.id },
        },
      },
    );
    expect(lockResponse2.response.status).toBe(409);
  });

  test("should not unlock a release target that was already unlocked", async ({
    api,
    page,
    workspace,
  }) => {
    const prefix = builder.refs.prefix;
    const resourceName = `${faker.string.alphanumeric(10)}-${prefix}`;
    const resourceResponse = await api.POST("/v1/resources", {
      body: {
        name: resourceName,
        kind: "service",
        identifier: resourceName,
        version: "1.0.0",
        config: {},
        workspaceId: workspace.id,
      },
    });
    expect(resourceResponse.response.status).toBe(200);
    expect(resourceResponse.data).toBeDefined();
    const resource = resourceResponse.data!;

    await page.waitForTimeout(5_000);

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: { resourceId: resource.id },
        },
      },
    );
    expect(releaseTargetResponse.response.status).toBe(200);
    expect(releaseTargetResponse.data).toBeDefined();
    expect(releaseTargetResponse.data!.length).toBe(1);
    const releaseTarget = releaseTargetResponse.data!.at(0)!;

    const lockResponse = await api.POST(
      "/v1/release-targets/{releaseTargetId}/lock",
      {
        params: {
          path: { releaseTargetId: releaseTarget.id },
        },
      },
    );
    expect(lockResponse.response.status).toBe(200);
    expect(lockResponse.data).toBeDefined();
    const lock = lockResponse.data!;

    expect(lock.lockedAt).toBeDefined();
    expect(lock.unlockedAt).toBeNull();
    expect(lock.lockedBy).toBeDefined();

    const unlockResponse = await api.POST(
      "/v1/release-targets/{releaseTargetId}/unlock",
      {
        params: {
          path: { releaseTargetId: releaseTarget.id },
        },
      },
    );
    expect(unlockResponse.response.status).toBe(200);
    const unlock = unlockResponse.data!;

    expect(unlock.unlockedAt).toBeDefined();

    const unlockResponse2 = await api.POST(
      "/v1/release-targets/{releaseTargetId}/unlock",
      {
        params: {
          path: { releaseTargetId: releaseTarget.id },
        },
      },
    );
    expect(unlockResponse2.response.status).toBe(400);
  });

  test("should not unlock a release target that was never locked", async ({
    api,
    page,
    workspace,
  }) => {
    const prefix = builder.refs.prefix;
    const resourceName = `${faker.string.alphanumeric(10)}-${prefix}`;
    const resourceResponse = await api.POST("/v1/resources", {
      body: {
        name: resourceName,
        kind: "service",
        identifier: resourceName,
        version: "1.0.0",
        config: {},
        workspaceId: workspace.id,
      },
    });
    expect(resourceResponse.response.status).toBe(200);
    expect(resourceResponse.data).toBeDefined();
    const resource = resourceResponse.data!;

    await page.waitForTimeout(5_000);

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: { resourceId: resource.id },
        },
      },
    );
    expect(releaseTargetResponse.response.status).toBe(200);
    expect(releaseTargetResponse.data).toBeDefined();
    expect(releaseTargetResponse.data!.length).toBe(1);
    const releaseTarget = releaseTargetResponse.data!.at(0)!;

    const unlockResponse = await api.POST(
      "/v1/release-targets/{releaseTargetId}/unlock",
      {
        params: {
          path: { releaseTargetId: releaseTarget.id },
        },
      },
    );
    expect(unlockResponse.response.status).toBe(400);
  });

  test("should handle concurrent lock requests", async ({
    api,
    page,
    workspace,
  }) => {
    const prefix = builder.refs.prefix;
    const resourceName = `${faker.string.alphanumeric(10)}-${prefix}`;
    const resourceResponse = await api.POST("/v1/resources", {
      body: {
        name: resourceName,
        kind: "service",
        identifier: resourceName,
        version: "1.0.0",
        config: {},
        workspaceId: workspace.id,
      },
    });
    expect(resourceResponse.response.status).toBe(200);
    expect(resourceResponse.data).toBeDefined();
    const resource = resourceResponse.data!;

    await page.waitForTimeout(5_000);

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: {
            resourceId: resource.id,
          },
        },
      },
    );
    expect(releaseTargetResponse.response.status).toBe(200);
    expect(releaseTargetResponse.data).toBeDefined();
    expect(releaseTargetResponse.data!.length).toBe(1);
    const releaseTarget = releaseTargetResponse.data!.at(0)!;

    const lockRequest1 = api.POST(
      "/v1/release-targets/{releaseTargetId}/lock",
      {
        params: {
          path: { releaseTargetId: releaseTarget.id },
        },
      },
    );

    const lockRequest2 = api.POST(
      "/v1/release-targets/{releaseTargetId}/lock",
      {
        params: {
          path: { releaseTargetId: releaseTarget.id },
        },
      },
    );

    const [lockResponse1, lockResponse2] = await Promise.all([
      lockRequest1,
      lockRequest2,
    ]);

    const statuses = [
      lockResponse1.response.status,
      lockResponse2.response.status,
    ];

    expect(statuses).toContain(200);
    expect(statuses).toContain(409);
  });
});
