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
    await builder.upsertSystem();
    await builder.upsertDeployments();
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.refs, workspace.id);
  });

  test("should create a deployment variable", async ({ api }) => {
    const importedDeployment = builder.refs.deployments[0]!;
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
    const importedDeployment = builder.refs.deployments[0]!;
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
          directValues: [
            {
              value: valueA,
              sensitive: false,
              resourceSelector: null,
            },
          ],
          referenceValues: [
            {
              reference: valueB,
              path: [],
              defaultValue: null,
              resourceSelector: null,
            },
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
    const receivedVariable = variables.find((v) => v.key === key);
    expect(receivedVariable).toBeDefined();

    const receivedDirectValues = receivedVariable!.directValues;
    expect(receivedDirectValues.length).toBe(1);
    const receivedDirectValue = receivedDirectValues[0]!;
    expect(receivedDirectValue.value).toBe(valueA);
    expect(receivedDirectValue.sensitive).toBe(false);
    expect(receivedDirectValue.resourceSelector).toBeNull();

    const receivedReferenceValues = receivedVariable!.referenceValues;
    expect(receivedReferenceValues.length).toBe(1);
    const receivedReferenceValue = receivedReferenceValues[0]!;
    expect(receivedReferenceValue.reference).toBe(valueB);
    expect(receivedReferenceValue.path).toEqual([]);
    expect(receivedReferenceValue.defaultValue).toBeNull();
    expect(receivedReferenceValue.resourceSelector).toBeNull();
  });

  test("should create a deployment variable with values and default value", async ({ api }) => {
    const importedDeployment = builder.refs.deployments[0]!;
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
          directValues: [
            {
              value: valueA,
              sensitive: false,
              resourceSelector: null,
            },
            {
              value: valueB,
              sensitive: false,
              resourceSelector: null,
              isDefault: true,
            },
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
    const receivedVariable = variables.find((v) => v.key === key);
    expect(receivedVariable).toBeDefined();

    const receivedDefaultValue = receivedVariable!.defaultValue;
    expect(receivedDefaultValue).toBeDefined();
    const isDirect = "value" in receivedDefaultValue!;
    expect(isDirect).toBeTruthy();
    if (isDirect) expect(receivedDefaultValue!.value).toBe(valueB);
  });

  test("shoudl fail if more than one default value is provided", async ({ api }) => {
    const importedDeployment = builder.refs.deployments[0]!;
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
          directValues: [
            {
              value: valueA,
              sensitive: false,
              resourceSelector: null,
              isDefault: true,
            },
            {
              value: valueB,
              sensitive: false,
              resourceSelector: null,
              isDefault: true,
            },
          ],
        },
      },
    );

    expect(variableCreateResponse.response.status).toBe(500);
    const variable = variableCreateResponse.data;
    expect(variable).toBeUndefined();
  });

  test("should update a deployment variable's values", async ({ api }) => {
    const importedDeployment = builder.refs.deployments[0]!;
    const key = faker.string.alphanumeric(10);

    const value = faker.string.alphanumeric(10);
    const reference = faker.string.alphanumeric(10);
    const path = [faker.string.alphanumeric(10), faker.string.alphanumeric(10)];

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
          directValues: [
            {
              value,
              sensitive: false,
              resourceSelector: null,
            },
          ],
          referenceValues: [
            {
              reference,
              path,
              defaultValue: null,
              resourceSelector: null,
            },
          ],
        },
      },
    );

    expect(variableCreateResponse.response.status).toBe(201);
    const variable = variableCreateResponse.data;
    expect(variable).toBeDefined();
    let receivedKey = variable?.key;
    expect(receivedKey).toBe(key);

    const variableUpdateResponse = await api.POST(
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
          directValues: [
            {
              value,
              sensitive: false,
              resourceSelector: {
                type: "identifier",
                operator: "equals",
                value: "test-a",
              },
            },
          ],
          referenceValues: [
            {
              reference,
              path,
              defaultValue: null,
              resourceSelector: {
                type: "identifier",
                operator: "equals",
                value: "test-a",
              },
            },
          ],
        },
      },
    );

    expect(variableUpdateResponse.response.status).toBe(201);

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
    const receivedVariable = variables.find((v) => v.key === key);
    expect(receivedVariable).toBeDefined();

    const receivedDirectValues = receivedVariable!.directValues;
    expect(receivedDirectValues).toBeDefined();
    expect(receivedDirectValues?.length).toBe(1);
    const receivedDirectValue = receivedDirectValues![0]!;
    expect(receivedDirectValue.value).toBe(value);
    expect(receivedDirectValue.resourceSelector).toBeDefined();
    expect(receivedDirectValue.resourceSelector?.type).toBe("identifier");
    expect(receivedDirectValue.resourceSelector?.operator).toBe("equals");
    expect(receivedDirectValue.resourceSelector?.value).toBe("test-a");

    const receivedReferenceValues = receivedVariable!.referenceValues;
    expect(receivedReferenceValues).toBeDefined();
    expect(receivedReferenceValues?.length).toBe(1);
    const receivedReferenceValue = receivedReferenceValues![0]!;
    expect(receivedReferenceValue.reference).toBe(reference);
    expect(receivedReferenceValue.path).toEqual(path);
    expect(receivedReferenceValue.defaultValue).toBeNull();
    expect(receivedReferenceValue.resourceSelector).toBeDefined();
    expect(receivedReferenceValue.resourceSelector?.type).toBe("identifier");
    expect(receivedReferenceValue.resourceSelector?.operator).toBe("equals");
    expect(receivedReferenceValue.resourceSelector?.value).toBe("test-a");
  });

  test("should update a deployment variable's default value", async ({ api }) => {
    const importedDeployment = builder.refs.deployments[0]!;
    const key = faker.string.alphanumeric(10);

    const value = faker.string.alphanumeric(10);
    const reference = faker.string.alphanumeric(10);
    const path = [faker.string.alphanumeric(10), faker.string.alphanumeric(10)];

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
          directValues: [
            {
              value,
              sensitive: false,
              resourceSelector: null,
            },
          ],
          referenceValues: [
            {
              reference,
              path,
              defaultValue: null,
              resourceSelector: null,
            },
          ],
        },
      },
    );

    expect(variableCreateResponse.response.status).toBe(201);
    const variable = variableCreateResponse.data;
    expect(variable).toBeDefined();
    let receivedKey = variable?.key;
    expect(receivedKey).toBe(key);

    const variableUpdateResponse = await api.POST(
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
          directValues: [
            {
              value,
              sensitive: false,
              resourceSelector: null,
              isDefault: true,
            },
          ],
          referenceValues: [
            {
              reference,
              path,
              defaultValue: null,
              resourceSelector: null,
            },
          ],
        },
      },
    );

    expect(variableUpdateResponse.response.status).toBe(201);

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
    const receivedVariable = variables.find((v) => v.key === key);
    expect(receivedVariable).toBeDefined();

    const receivedDefaultValue = receivedVariable!.defaultValue;
    expect(receivedDefaultValue).toBeDefined();
    const isDirect = "value" in receivedDefaultValue!;
    expect(isDirect).toBeTruthy();
    if (isDirect) expect(receivedDefaultValue!.value).toBe(value);
  });

  test("should be able to add more values to a variable", async ({ api }) => {
    const importedDeployment = builder.refs.deployments[0]!;
    const key = faker.string.alphanumeric(10);

    const valueA = faker.string.alphanumeric(10);
    const referenceA = faker.string.alphanumeric(10);
    const pathA = [
      faker.string.alphanumeric(10),
      faker.string.alphanumeric(10),
    ];

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
          directValues: [
            {
              value: valueA,
              sensitive: false,
              resourceSelector: null,
            },
          ],
          referenceValues: [
            {
              reference: referenceA,
              path: pathA,
              defaultValue: null,
              resourceSelector: null,
            },
          ],
        },
      },
    );

    expect(variableCreateResponse.response.status).toBe(201);

    const valueB = faker.string.alphanumeric(10);
    const referenceB = faker.string.alphanumeric(10);
    const pathB = [
      faker.string.alphanumeric(10),
      faker.string.alphanumeric(10),
    ];

    const variableUpdateResponse = await api.POST(
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
          directValues: [
            {
              value: valueB,
              sensitive: false,
              resourceSelector: null,
            },
          ],
          referenceValues: [
            {
              reference: referenceB,
              path: pathB,
              defaultValue: null,
              resourceSelector: null,
            },
          ],
        },
      },
    );

    expect(variableUpdateResponse.response.status).toBe(201);

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
    const receivedVariable = variables.find((v) => v.key === key);
    expect(receivedVariable).toBeDefined();

    const receivedDirectValues = receivedVariable!.directValues;
    expect(receivedDirectValues).toBeDefined();
    expect(receivedDirectValues?.length).toBe(2);

    const receivedDirectValueA = receivedDirectValues.find(
      (v) => v.value === valueA,
    );
    expect(receivedDirectValueA).toBeDefined();
    const receivedDirectValueB = receivedDirectValues.find(
      (v) => v.value === valueB,
    );
    expect(receivedDirectValueB).toBeDefined();

    const receivedReferenceValues = receivedVariable!.referenceValues;
    expect(receivedReferenceValues).toBeDefined();
    expect(receivedReferenceValues?.length).toBe(2);

    const receivedReferenceValueA = receivedReferenceValues.find(
      (v) => v.reference === referenceA,
    );
    expect(receivedReferenceValueA).toBeDefined();
    const receivedReferenceValueB = receivedReferenceValues.find(
      (v) => v.reference === referenceB,
    );
    expect(receivedReferenceValueB).toBeDefined();
  });

  test("should be able to convert an insensitive value to a sensitive value", async ({ api }) => {
    const importedDeployment = builder.refs.deployments[0]!;
    const key = faker.string.alphanumeric(10);
    const value = faker.string.alphanumeric(10);

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
          directValues: [
            {
              value,
              sensitive: false,
              resourceSelector: null,
            },
          ],
        },
      },
    );

    expect(variableCreateResponse.response.status).toBe(201);
    const variable = variableCreateResponse.data;
    expect(variable).toBeDefined();
    let receivedKey = variable?.key;
    expect(receivedKey).toBe(key);

    const variableUpdateResponse = await api.POST(
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
          directValues: [
            {
              value,
              sensitive: true,
              resourceSelector: null,
            },
          ],
        },
      },
    );

    expect(variableUpdateResponse.response.status).toBe(201);

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
    const receivedVariable = variables.find((v) => v.key === key);
    expect(receivedVariable).toBeDefined();

    const receivedDirectValues = receivedVariable!.directValues;
    expect(receivedDirectValues).toBeDefined();
    expect(receivedDirectValues?.length).toBe(1);
    const receivedDirectValue = receivedDirectValues![0]!;
    expect(receivedDirectValue.value).toBe(value);
    expect(receivedDirectValue.sensitive).toBe(true);
  });

  test("should be able to convert a sensitive value to an insensitive value", async ({ api }) => {
    const importedDeployment = builder.refs.deployments[0]!;
    const key = faker.string.alphanumeric(10);
    const value = faker.string.alphanumeric(10);

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
          directValues: [
            {
              value,
              sensitive: true,
              resourceSelector: null,
            },
          ],
        },
      },
    );

    expect(variableCreateResponse.response.status).toBe(201);
    const variable = variableCreateResponse.data;
    expect(variable).toBeDefined();
    let receivedKey = variable?.key;
    expect(receivedKey).toBe(key);

    const variableUpdateResponse = await api.POST(
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
          directValues: [
            {
              value,
              sensitive: false,
              resourceSelector: null,
            },
          ],
        },
      },
    );

    expect(variableUpdateResponse.response.status).toBe(201);

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
    const receivedVariable = variables.find((v) => v.key === key);
    expect(receivedVariable).toBeDefined();

    const receivedDirectValues = receivedVariable!.directValues;
    expect(receivedDirectValues).toBeDefined();
    expect(receivedDirectValues?.length).toBe(1);
    const receivedDirectValue = receivedDirectValues![0]!;
    expect(receivedDirectValue.value).toBe(value);
    expect(receivedDirectValue.sensitive).toBe(false);
  });
});
