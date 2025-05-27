import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { cleanupImportedEntities, EntitiesBuilder } from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "deployment-variable.spec.yaml");

test.describe("Deployment Variables API", () => {
  let builder: EntitiesBuilder;

  test.beforeAll(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);
    await builder.createSystem();
    await builder.createDeployments();
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.result, workspace.id);
  });

  test("should create a deployment variable", async ({ api }) => {
    const importedDeployment = builder.result.deployments[0]!;
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
    const importedDeployment = builder.result.deployments[0]!;
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
          values: [
            { value: valueA, valueType: "direct" },
            { value: valueB, valueType: "direct" },
          ],
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
    const receivedValueA = receivedValues[0]!.valueType === "direct"
      ? receivedValues[0]!.value
      : receivedValues[0]!.defaultValue;
    const receivedValueB = receivedValues[1]!.valueType === "direct"
      ? receivedValues[1]!.value
      : receivedValues[1]!.defaultValue;
    expect(receivedValueA).toBe(valueA);
    expect(receivedValueB).toBe(valueB);
  });

  test("should create a deployment variable with values and default value", async ({ api }) => {
    const importedDeployment = builder.result.deployments[0]!;
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
          values: [
            { value: valueA, valueType: "direct" },
            { value: valueB, valueType: "direct", default: true },
          ],
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
    const receivedValueA = receivedValues[0]!.valueType === "direct"
      ? receivedValues[0]!.value
      : receivedValues[0]!.defaultValue;
    const receivedValueB = receivedValues[1]!.valueType === "direct"
      ? receivedValues[1]!.value
      : receivedValues[1]!.defaultValue;
    expect(receivedValueA).toBe(valueA);
    expect(receivedValueB).toBe(valueB);

    const receivedDefaultValue = receivedValues[1]!.valueType === "direct"
      ? receivedValues[1]!.value
      : receivedValues[1]!.defaultValue;

    expect(receivedDefaultValue).toBe(valueB);
  });

  test("shoudl fail if more than one default value is provided", async ({ api }) => {
    const importedDeployment = builder.result.deployments[0]!;
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
          values: [
            { value: valueA, valueType: "direct", default: true },
            { value: valueB, valueType: "direct", default: true },
          ],
        },
      },
    );

    expect(variableCreateResponse.response.status).toBe(400);
    const variable = variableCreateResponse.data;
    expect(variable).toBeUndefined();
  });
});
