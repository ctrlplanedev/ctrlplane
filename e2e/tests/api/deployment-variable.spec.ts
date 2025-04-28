import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import {
  cleanupImportedEntities,
  ImportedEntities,
  importEntitiesFromYaml,
} from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "deployment-variable.spec.yaml");

test.describe("Deployment Variables API", () => {
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

  test("should create a deployment variable", async ({ api }) => {
    const importedDeployment = importedEntities.deployments[0]!;
    const key = faker.string.alphanumeric(10);

    const variableCreateResponse = await api.POST(
      "/v1/deployments/{deploymentId}/variables",
      {
        params: {
          path: {
            deploymentId: importedDeployment.id,
          },
        },
        body: {
          key,
          config: {
            type: "string",
            inputType: "text",
          },
          deploymentId: importedDeployment.id,
        },
      },
    );

    expect(variableCreateResponse.response.status).toBe(201);
    const variable = variableCreateResponse.data;
    expect(variable).toBeDefined();
    const receivedKey = variable?.key;
    expect(receivedKey).toBe(key);

    const variableGetResponse = await api.GET(
      "/v1/deployments/{deploymentId}/variables",
      {
        params: {
          path: {
            deploymentId: importedDeployment.id,
          },
        },
      },
    );

    expect(variableGetResponse.response.status).toBe(200);
    const variables = variableGetResponse.data ?? [];
    expect(variables.length).toBe(1);
    const receivedVariable = variables[0]!;
    const receivedGetKey = receivedVariable.key;
    expect(receivedGetKey).toBe(key);
  });

  test("should create a deployment variable with values", async ({ api }) => {
    const importedDeployment = importedEntities.deployments[0]!;
    const key = faker.string.alphanumeric(10);

    const valueA = faker.string.alphanumeric(10);
    const valueB = faker.string.alphanumeric(10);

    const variableCreateResponse = await api.POST(
      "/v1/deployments/{deploymentId}/variables",
      {
        params: {
          path: {
            deploymentId: importedDeployment.id,
          },
        },
        body: {
          key,
          config: {
            type: "string",
            inputType: "text",
          },
          deploymentId: importedDeployment.id,
          values: [{ value: valueA }, { value: valueB }],
        },
      },
    );

    expect(variableCreateResponse.response.status).toBe(201);
    const variable = variableCreateResponse.data;
    expect(variable).toBeDefined();
    const receivedKey = variable?.key;
    expect(receivedKey).toBe(key);

    const variableGetResponse = await api.GET(
      "/v1/deployments/{deploymentId}/variables",
      {
        params: {
          path: {
            deploymentId: importedDeployment.id,
          },
        },
      },
    );

    expect(variableGetResponse.response.status).toBe(200);
    const variables = variableGetResponse.data ?? [];
    expect(variables.length).toBe(1);
    const receivedVariable = variables[0]!;
    const receivedGetKey = receivedVariable.key;
    expect(receivedGetKey).toBe(key);

    const receivedValues = receivedVariable.values;
    expect(receivedValues.length).toBe(2);
    const receivedValueA = receivedValues[0]!.value;
    const receivedValueB = receivedValues[1]!.value;
    expect(receivedValueA).toBe(valueA);
    expect(receivedValueB).toBe(valueB);
  });

  test("should create a deployment variable with values and default value", async ({
    api,
  }) => {
    const importedDeployment = importedEntities.deployments[0]!;
    const key = faker.string.alphanumeric(10);

    const valueA = faker.string.alphanumeric(10);
    const valueB = faker.string.alphanumeric(10);

    const variableCreateResponse = await api.POST(
      "/v1/deployments/{deploymentId}/variables",
      {
        params: {
          path: {
            deploymentId: importedDeployment.id,
          },
        },
        body: {
          key,
          config: {
            type: "string",
            inputType: "text",
          },
          deploymentId: importedDeployment.id,
          values: [{ value: valueA }, { value: valueB, default: true }],
        },
      },
    );

    expect(variableCreateResponse.response.status).toBe(201);
    const variable = variableCreateResponse.data;
    expect(variable).toBeDefined();
    const receivedKey = variable?.key;
    expect(receivedKey).toBe(key);

    const variableGetResponse = await api.GET(
      "/v1/deployments/{deploymentId}/variables",
      {
        params: {
          path: {
            deploymentId: importedDeployment.id,
          },
        },
      },
    );

    expect(variableGetResponse.response.status).toBe(200);
    const variables = variableGetResponse.data ?? [];
    expect(variables.length).toBe(1);
    const receivedVariable = variables[0]!;
    const receivedGetKey = receivedVariable.key;
    expect(receivedGetKey).toBe(key);

    const receivedValues = receivedVariable.values;
    expect(receivedValues.length).toBe(2);
    const receivedValueA = receivedValues[0]!.value;
    const receivedValueB = receivedValues[1]!.value;
    expect(receivedValueA).toBe(valueA);
    expect(receivedValueB).toBe(valueB);

    const receivedDefaultValue = receivedVariable.defaultValue;
    expect(receivedDefaultValue?.value).toBe(valueB);
  });

  test("shoudl fail if more than one default value is provided", async ({
    api,
  }) => {
    const importedDeployment = importedEntities.deployments[0]!;
    const key = faker.string.alphanumeric(10);

    const valueA = faker.string.alphanumeric(10);
    const valueB = faker.string.alphanumeric(10);

    const variableCreateResponse = await api.POST(
      "/v1/deployments/{deploymentId}/variables",
      {
        params: {
          path: {
            deploymentId: importedDeployment.id,
          },
        },
        body: {
          key,
          config: {
            type: "string",
            inputType: "text",
          },
          deploymentId: importedDeployment.id,
          values: [
            { value: valueA, default: true },
            { value: valueB, default: true },
          ],
        },
      },
    );

    expect(variableCreateResponse.response.status).toBe(400);
    const variable = variableCreateResponse.data;
    expect(variable).toBeUndefined();
  });
});
