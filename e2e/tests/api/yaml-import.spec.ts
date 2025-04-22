import path from "path";
import { expect } from "@playwright/test";

import {
  cleanupImportedEntities,
  ImportedEntities,
  importEntitiesFromYaml,
} from "../../api/yaml-loader";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "yaml-import.spec.yaml");

test.describe("YAML Entity Import", () => {
  let importedEntities: ImportedEntities;

  test.beforeAll(async ({ api, workspace }) => {
    // Import entities from YAML file
    importedEntities = await importEntitiesFromYaml(
      api,
      workspace.id,
      yamlPath,
    );

    // Allow time for resources to be processed
    await new Promise((resolve) => setTimeout(resolve, 5000));
  });

  test.afterAll(async ({ api, workspace }) => {
    // Clean up all imported entities
    if (importedEntities) {
      await cleanupImportedEntities(api, importedEntities, workspace.id);
    }
  });

  test("should have created a system from YAML", async ({ api }) => {
    // Get the system by ID
    const response = await api.GET("/v1/systems/{systemId}", {
      params: { path: { systemId: importedEntities.system.id } },
    });

    // Verify system data
    expect(response.response.status).toBe(200);
    expect(response.data?.description).toBe("System created from YAML fixture");
  });

  test("should have created resources from YAML", async ({
    api,
    workspace,
  }) => {
    // List resources in workspace
    const response = await api.GET("/v1/workspaces/{workspaceId}/resources", {
      params: { path: { workspaceId: workspace.id } },
    });

    // Verify resources were created
    expect(response.response.status).toBe(200);
    expect(response.data?.resources).toBeDefined();

    // Check for our specific resources
    const resources = response.data!.resources!;
    const prodResource1 = resources.find((r) => r.name === "Prod Resource 1");
    const prodResource2 = resources.find((r) => r.name === "Prod Resource 2");
    const stagingResource = resources.find(
      (r) => r.name === "Staging Resource 1",
    );

    expect(prodResource1).toBeDefined();
    expect(prodResource2).toBeDefined();
    expect(stagingResource).toBeDefined();
  });

  test("should have created environments from YAML", async ({ api }) => {
    // Check that we have correct number of environments
    expect(importedEntities.environments.length).toBe(2);

    // Get environment details for first environment
    const prodEnvId = importedEntities.environments.find(
      (e) => e.name === "Production",
    )?.id;
    expect(prodEnvId).toBeDefined();

    const prodEnvResponse = await api.GET("/v1/environments/{environmentId}", {
      params: { path: { environmentId: prodEnvId! } },
    });

    // Verify production environment
    expect(prodEnvResponse.response.status).toBe(200);
    expect(prodEnvResponse.data?.name).toBe("Production");
    expect(prodEnvResponse.data?.resourceSelector).toBeDefined();
  });

  test("should have created deployments from YAML", async ({ api }) => {
    expect(importedEntities.deployments.length).toBe(2);

    const apiDeploymentId = importedEntities.deployments.find(
      (d) => d.name === "API Deployment",
    )?.id;
    expect(apiDeploymentId).toBeDefined();

    const deploymentResponse = await api.GET("/v1/deployments/{deploymentId}", {
      params: { path: { deploymentId: apiDeploymentId! } },
    });

    // Verify API deployment
    expect(deploymentResponse.response.status).toBe(200);
    expect(deploymentResponse.data?.name).toBe("API Deployment");
    expect(deploymentResponse.data?.slug).toBe("api-deployment");
  });
});
