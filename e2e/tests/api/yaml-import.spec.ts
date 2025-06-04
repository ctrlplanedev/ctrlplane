import path from "path";
import { expect } from "@playwright/test";

import { cleanupImportedEntities, EntitiesBuilder } from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "yaml-import.spec.yaml");

test.describe("YAML Entity Import", () => {
  let builder: EntitiesBuilder;

  test.beforeAll(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);
    await builder.upsertSystem();
    await builder.upsertResources();
    await builder.upsertEnvironments();
    await builder.upsertDeployments();
    await builder.createDeploymentVariables();
    await builder.upsertPolicies();

    // Allow time for resources to be processed
    await new Promise((resolve) => setTimeout(resolve, 5000));
  });

  test.afterAll(async ({ api, workspace }) => {
    // Clean up all imported entities
    cleanupImportedEntities(api, builder.refs, workspace.id);
  });

  test("should have created a system from YAML", async ({ api }) => {
    // Get the system by ID
    const response = await api.GET("/v1/systems/{systemId}", {
      params: { path: { systemId: builder.refs.system.id } },
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
    expect(builder.refs.environments.length).toBe(2);

    // Get environment details for first environment
    const prodEnvId = builder.refs.environments.find(
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
    expect(builder.refs.deployments.length).toBe(2);

    const apiDeploymentId = builder.refs.deployments.find(
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

    // Verify variables
    const variablesResponse = await api.GET(
      "/v1/deployments/{deploymentId}/variables",
      {
        params: { path: { deploymentId: apiDeploymentId! } },
      },
    );

    expect(variablesResponse.response.status).toBe(200);
    const variables = variablesResponse.data ?? [];
    expect(variables.length).toBe(1);
    const variable = variables[0]!;
    expect(variable.key).toBe("API_KEY");
    expect(variable.description).toBe("API key");
    expect(variable.config.type).toBe("string");
    expect(variable.config.inputType).toBe("text");

    const { directValues } = variable;
    expect(directValues.length).toBe(1);
    const value = directValues[0]!;
    expect(value.value).toBe("sample-api-key");

    const defaultValue = variable.defaultValue;
    expect(defaultValue).toBeDefined();
    const isDirectValue = "value" in defaultValue!;
    expect(isDirectValue).toBe(true);
    if (isDirectValue) expect(defaultValue?.value).toBe("sample-api-key");
  });
});
