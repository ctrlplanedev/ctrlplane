import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import {
  cleanupImportedEntities,
  ImportedEntities,
  importEntitiesFromYaml,
} from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "release.spec.yaml");

test.describe("Release Creation", () => {
  let importedEntities: ImportedEntities;

  test.beforeAll(async ({ api, workspace }) => {
    importedEntities = await importEntitiesFromYaml(
      api,
      workspace.id,
      yamlPath,
    );
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, importedEntities, workspace.id);
  });

  test("should create a release when a new version is created", async ({
    api,
    page,
    workspace,
  }) => {
    const importedResource = importedEntities.resources.at(0)!;
    const resourceResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: importedResource.identifier,
          },
        },
      },
    );
    expect(resourceResponse.response.status).toBe(200);
    const resource = resourceResponse.data;
    expect(resource).toBeDefined();
    const resourceId = resource?.id ?? "";

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: {
            resourceId,
          },
        },
      },
    );
    expect(releaseTargetResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetResponse.data ?? [];
    expect(releaseTargets.length).toBe(1);
    const releaseTarget = releaseTargets[0]!;

    const importedDeployment = importedEntities.deployments[0]!;
    const importedEnvironment = importedEntities.environments[0]!;

    expect(releaseTarget.resource.id).toBe(resourceId);
    expect(releaseTarget.environment.id).toBe(importedEnvironment.id);
    expect(releaseTarget.deployment.id).toBe(importedDeployment.id);

    const versionTag = faker.string.alphanumeric(10);

    const versionResponse = await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId: importedDeployment.id,
        tag: versionTag,
      },
    });
    expect(versionResponse.response.status).toBe(201);

    await page.waitForTimeout(10_000);

    const releaseResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      {
        params: {
          path: {
            releaseTargetId: releaseTarget.id,
          },
        },
      },
    );

    expect(releaseResponse.response.status).toBe(200);
    const releases = releaseResponse.data ?? [];
    const matchedRelease = releases.find(
      (release) => release.version.tag === versionTag,
    );
    expect(matchedRelease).toBeDefined();
  });

  test("should create a release when a new resource is created", async ({
    api,
    workspace,
  }) => {
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const resourceName = `${systemPrefix}-resource-2`;
    const resourceResponse = await api.POST("/v1/resources", {
      body: {
        name: resourceName,
        kind: "service",
        identifier: resourceName,
        version: "1.0.0",
        config: {},
        metadata: {},
        variables: [],
        workspaceId: workspace.id,
      },
    });
    expect(resourceResponse.response.status).toBe(200);
    const resource = resourceResponse.data;
    expect(resource).toBeDefined();
    const resourceId = resource?.id ?? "";

    await new Promise((resolve) => setTimeout(resolve, 10_000));

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: {
            resourceId,
          },
        },
      },
    );
    expect(releaseTargetResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetResponse.data ?? [];
    expect(releaseTargets.length).toBe(1);
    const releaseTarget = releaseTargets[0]!;

    expect(releaseTarget.resource.id).toBe(resourceId);

    const releaseResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      {
        params: {
          path: {
            releaseTargetId: releaseTarget.id,
          },
        },
      },
    );
    expect(releaseResponse.response.status).toBe(200);
    const releases = releaseResponse.data ?? [];
    console.log(releases);
    const versionTag = importedEntities.deployments.at(0)!.versions!.at(0)!.tag;
    const matchedRelease = releases.find(
      (release) => release.version.tag === versionTag,
    );
    expect(matchedRelease).toBeDefined();
  });

  test("should not create a release when an existing resource is updated", async ({
    api,
    workspace,
  }) => {
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const resourceName = `${systemPrefix}-resource-2`;
    const resourceResponse = await api.POST("/v1/resources", {
      body: {
        name: resourceName,
        kind: "service",
        identifier: resourceName,
        version: "1.0.0",
        config: {},
        metadata: {},
        variables: [],
        workspaceId: workspace.id,
      },
    });
    expect(resourceResponse.response.status).toBe(200);
    const resource = resourceResponse.data;
    expect(resource).toBeDefined();
    const resourceId = resource?.id ?? "";

    await new Promise((resolve) => setTimeout(resolve, 5_000));

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: {
            resourceId,
          },
        },
      },
    );
    expect(releaseTargetResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetResponse.data ?? [];
    expect(releaseTargets.length).toBe(1);
    const releaseTarget = releaseTargets[0]!;

    expect(releaseTarget.resource.id).toBe(resourceId);

    const releaseResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      {
        params: {
          path: {
            releaseTargetId: releaseTarget.id,
          },
        },
      },
    );
    expect(releaseResponse.response.status).toBe(200);
    const releases = releaseResponse.data ?? [];
    console.log(releases);
    const versionTag = importedEntities.deployments.at(0)!.versions!.at(0)!.tag;
    const matchedRelease = releases.find(
      (release) => release.version.tag === versionTag,
    );
    expect(matchedRelease).toBeDefined();

    const updatedResourceResponse = await api.PATCH(
      "/v1/resources/{resourceId}",
      {
        params: {
          path: {
            resourceId,
          },
        },
        body: {
          version: "1.0.1",
        },
      },
    );
    expect(updatedResourceResponse.response.status).toBe(200);

    const releaseTargetResponseAfterUpdate = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: { path: { resourceId } },
      },
    );
    expect(releaseTargetResponseAfterUpdate.response.status).toBe(200);
    const releaseTargetsAfterUpdate =
      releaseTargetResponseAfterUpdate.data ?? [];
    expect(releaseTargetsAfterUpdate.length).toBe(1);
    const releaseTargetAfterUpdate = releaseTargetsAfterUpdate[0]!;
    expect(releaseTargetAfterUpdate.resource.id).toBe(resourceId);

    const releaseResponseAfterUpdate = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      {
        params: { path: { releaseTargetId: releaseTargetAfterUpdate.id } },
      },
    );
    expect(releaseResponseAfterUpdate.response.status).toBe(200);
    const releasesAfterUpdate = releaseResponseAfterUpdate.data ?? [];
    expect(releasesAfterUpdate.length).toBe(1);
    const matchedReleaseAfterUpdate = releasesAfterUpdate.find(
      (release) => release.version.tag === versionTag,
    );
    expect(matchedReleaseAfterUpdate).toBeDefined();
  });
});
