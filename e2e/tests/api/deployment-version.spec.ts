import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import {
  cleanupImportedEntities,
  ImportedEntities,
  importEntitiesFromYaml,
} from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "deployment-version.spec.yaml");

test.describe("Deployment Versions API", () => {
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

  test("should create a deployment version", async ({ api }) => {
    const versionName = faker.string.alphanumeric(10);
    const versionTag = faker.string.alphanumeric(10);

    const deploymentVersionResponse = await api.POST(
      "/v1/deployment-versions",
      {
        body: {
          name: versionName,
          tag: versionTag,
          deploymentId: importedEntities.deployments[0].id,
          metadata: { enabled: "true" },
        },
      },
    );

    expect(deploymentVersionResponse.response.status).toBe(201);
    const deploymentVersion = deploymentVersionResponse.data;
    expect(deploymentVersion).toBeDefined();
    if (!deploymentVersion) throw new Error("Deployment version not found");

    expect(deploymentVersion.name).toBe(versionName);
    expect(deploymentVersion.tag).toBe(versionTag);
    expect(deploymentVersion.deploymentId).toBe(
      importedEntities.deployments[0].id,
    );
    expect(deploymentVersion.metadata).toEqual({ enabled: "true" });
    expect(deploymentVersion.status).toBe("ready");
  });

  test("name should default to version tag if name not provided", async ({
    api,
  }) => {
    const versionTag = faker.string.alphanumeric(10);

    const deploymentVersionResponse = await api.POST(
      "/v1/deployment-versions",
      {
        body: {
          tag: versionTag,
          deploymentId: importedEntities.deployments[0].id,
        },
      },
    );

    expect(deploymentVersionResponse.response.status).toBe(201);
    const deploymentVersion = deploymentVersionResponse.data;
    expect(deploymentVersion).toBeDefined();
    if (!deploymentVersion) throw new Error("Deployment version not found");

    expect(deploymentVersion.name).toBe(versionTag);
  });

  test("should create a deployment version in building status", async ({
    api,
  }) => {
    const versionTag = faker.string.alphanumeric(10);

    const deploymentVersionResponse = await api.POST(
      "/v1/deployment-versions",
      {
        body: {
          tag: versionTag,
          deploymentId: importedEntities.deployments[0].id,
          status: "building",
        },
      },
    );

    expect(deploymentVersionResponse.response.status).toBe(201);
    const deploymentVersion = deploymentVersionResponse.data;
    expect(deploymentVersion).toBeDefined();
    if (!deploymentVersion) throw new Error("Deployment version not found");

    expect(deploymentVersion.status).toBe("building");
  });

  test("should update basic deployment version fields", async ({ api }) => {
    const versionTag = faker.string.alphanumeric(10);
    const versionName = faker.string.alphanumeric(10);

    const deploymentVersionResponse = await api.POST(
      "/v1/deployment-versions",
      {
        body: {
          tag: versionTag,
          deploymentId: importedEntities.deployments[0].id,
          name: versionName,
          metadata: { enabled: "true" },
        },
      },
    );

    expect(deploymentVersionResponse.response.status).toBe(201);
    const deploymentVersion = deploymentVersionResponse.data;
    expect(deploymentVersion).toBeDefined();
    if (!deploymentVersion) throw new Error("Deployment version not found");

    const newVersionName = faker.string.alphanumeric(10);
    const newVersionTag = faker.string.alphanumeric(10);

    const updatedDeploymentVersionResponse = await api.PATCH(
      `/v1/deployment-versions/{deploymentVersionId}`,
      {
        params: {
          path: { deploymentVersionId: deploymentVersion.id },
        },
        body: {
          tag: newVersionTag,
          name: newVersionName,
          metadata: { enabled: "false" },
        },
      },
    );

    expect(updatedDeploymentVersionResponse.response.status).toBe(200);
    const updatedDeploymentVersion = updatedDeploymentVersionResponse.data;
    expect(updatedDeploymentVersion).toBeDefined();
    if (!updatedDeploymentVersion)
      throw new Error("Deployment version not found");

    expect(updatedDeploymentVersion.name).toBe(newVersionName);
    expect(updatedDeploymentVersion.tag).toBe(newVersionTag);
    expect(updatedDeploymentVersion.metadata).toEqual({ enabled: "false" });
  });

  test("should update deployment version status to ready", async ({ api }) => {
    const deploymentVersionResponse = await api.POST(
      "/v1/deployment-versions",
      {
        body: {
          tag: faker.string.alphanumeric(10),
          deploymentId: importedEntities.deployments[0].id,
          status: "building",
        },
      },
    );

    expect(deploymentVersionResponse.response.status).toBe(201);
    const deploymentVersion = deploymentVersionResponse.data;
    expect(deploymentVersion).toBeDefined();
    if (!deploymentVersion) throw new Error("Deployment version not found");

    expect(deploymentVersion.status).toBe("building");

    const updatedDeploymentVersionResponse = await api.PATCH(
      `/v1/deployment-versions/{deploymentVersionId}`,
      {
        params: {
          path: { deploymentVersionId: deploymentVersion.id },
        },
        body: {
          status: "ready",
        },
      },
    );

    expect(updatedDeploymentVersionResponse.response.status).toBe(200);
    const updatedDeploymentVersion = updatedDeploymentVersionResponse.data;
    expect(updatedDeploymentVersion).toBeDefined();
    if (!updatedDeploymentVersion)
      throw new Error("Deployment version not found");

    expect(updatedDeploymentVersion.status).toBe("ready");
  });

  test("should update deployment version status to failed", async ({ api }) => {
    const deploymentVersionResponse = await api.POST(
      "/v1/deployment-versions",
      {
        body: {
          tag: faker.string.alphanumeric(10),
          deploymentId: importedEntities.deployments[0].id,
          status: "building",
        },
      },
    );

    expect(deploymentVersionResponse.response.status).toBe(201);
    const deploymentVersion = deploymentVersionResponse.data;
    expect(deploymentVersion).toBeDefined();
    if (!deploymentVersion) throw new Error("Deployment version not found");

    expect(deploymentVersion.status).toBe("building");

    const updatedDeploymentVersionResponse = await api.PATCH(
      `/v1/deployment-versions/{deploymentVersionId}`,
      {
        params: {
          path: { deploymentVersionId: deploymentVersion.id },
        },
        body: {
          status: "failed",
        },
      },
    );

    expect(updatedDeploymentVersionResponse.response.status).toBe(200);
    const updatedDeploymentVersion = updatedDeploymentVersionResponse.data;
    expect(updatedDeploymentVersion).toBeDefined();
    if (!updatedDeploymentVersion)
      throw new Error("Deployment version not found");

    expect(updatedDeploymentVersion.status).toBe("failed");
  });
});
