import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import {
  cleanupImportedEntities,
  ImportedEntities,
  importEntitiesFromYaml,
} from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "deployments.spec.yaml");

test.describe("Deployments API", () => {
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

  test("should create a deployment", async ({ api }) => {
    const deploymentName = faker.string.alphanumeric(10);
    const deployment = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
        systemId: importedEntities.system.id,
      },
    });

    expect(deployment.response.status).toBe(201);
    expect(deployment.data?.id).toBeDefined();
    expect(deployment.data?.name).toBe(deploymentName);
    expect(deployment.data?.slug).toBe(deploymentName);
  });
});
