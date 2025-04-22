import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { test } from "../fixtures";

test.describe("Resource Provider API", () => {
  test("set resources for a provider", async ({ api, workspace }) => {
    // First create a resource provider
    const providerName = faker.string.alphanumeric(10);

    // Create or retrieve a resource provider
    const providerResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            name: providerName,
          },
        },
      },
    );

    expect(providerResponse.response.status).toBe(200);
    const { data: provider } = providerResponse;
    expect(provider?.id).toBeDefined();
    const providerId = provider?.id as string;

    // Test data for resources
    const resourceName1 = faker.string.alphanumeric(10);
    const resourceName2 = faker.string.alphanumeric(10);

    // Call the set endpoint to set resources for the provider
    const setResponse = await api.PATCH(
      "/v1/resource-providers/{providerId}/set",
      {
        params: {
          path: { providerId },
        },
        body: {
          resources: [
            {
              name: resourceName1,
              kind: "ProviderTest",
              identifier: resourceName1,
              version: "test-version/v1",
              config: { "e2e-test": true } as any,
              metadata: { "e2e-test": "true" },
            },
            {
              name: resourceName2,
              kind: "ProviderTest",
              identifier: resourceName2,
              version: "test-version/v1",
              config: { "e2e-test": true } as any,
              metadata: { "e2e-test": "true" },
              variables: [
                {
                  key: "test-var",
                  value: "test-value",
                  sensitive: false,
                },
              ],
            },
          ],
        },
      },
    );

    // Verify response
    expect(setResponse.response.status).toBe(200);
    expect(setResponse.data?.resources).toBeDefined();
    expect(Array.isArray(setResponse.data?.resources?.all)).toBe(true);
    expect(setResponse.data?.resources?.all?.length).toBe(2);

    // Verify resources were created
    const resource1Response = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: resourceName1,
          },
        },
      },
    );

    expect(resource1Response.response.status).toBe(200);
    expect(resource1Response.data?.name).toBe(resourceName1);
    expect(resource1Response.data?.kind).toBe("ProviderTest");
    expect(resource1Response.data?.metadata?.["e2e-test"]).toBe("true");

    const resource2Response = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: resourceName2,
          },
        },
      },
    );

    expect(resource2Response.response.status).toBe(200);
    expect(resource2Response.data?.name).toBe(resourceName2);
    expect(resource2Response.data?.variables).toBeDefined();
    expect(resource2Response.data?.variables?.[0]?.key).toBe("test-var");
    expect(resource2Response.data?.variables?.[0]?.value).toBe("test-value");
  });
});
