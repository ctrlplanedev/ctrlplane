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

    expect(setResponse.data?.resources?.ignored?.length).toBe(0);
    expect(setResponse.data?.resources?.inserted?.length).toBe(2);
    expect(setResponse.data?.resources?.updated?.length).toBe(0);
    expect(setResponse.data?.resources?.deleted?.length).toBe(0);

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
    expect(resource2Response.data?.variables?.["test-var"]).toBe("test-value");
  });

  test("delete resources by omitting them from set payload", async ({
    api,
    workspace,
  }) => {
    // Create a resource provider
    const providerName = faker.string.alphanumeric(10);

    // Get the provider ID
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
    const providerId = providerResponse.data?.id as string;

    // Create test resources
    const resourceName1 = faker.string.alphanumeric(10);
    const resourceName2 = faker.string.alphanumeric(10);
    const resourceName3 = faker.string.alphanumeric(10);

    // First set all three resources
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
            },
            {
              name: resourceName3,
              kind: "ProviderTest",
              identifier: resourceName3,
              version: "test-version/v1",
              config: { "e2e-test": true } as any,
              metadata: { "e2e-test": "true" },
            },
          ],
        },
      },
    );

    expect(setResponse.response.status).toBe(200);
    expect(setResponse.data?.resources?.ignored?.length).toBe(0);
    expect(setResponse.data?.resources?.inserted?.length).toBe(3);
    expect(setResponse.data?.resources?.updated?.length).toBe(0);
    expect(setResponse.data?.resources?.deleted?.length).toBe(0);

    // Now omit resourceName2 and resourceName3 from the updated resources list
    const updateResponse = await api.PATCH(
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
              metadata: { "e2e-test": "updated" }, // Update metadata to verify it's the same resource
            },
          ],
        },
      },
    );

    expect(updateResponse.response.status).toBe(200);
    expect(updateResponse.data?.resources?.ignored?.length).toBe(0);
    expect(updateResponse.data?.resources?.inserted?.length).toBe(0);
    expect(updateResponse.data?.resources?.updated?.length).toBe(1);
    expect(updateResponse.data?.resources?.deleted?.length).toBe(2);

    // Verify only resourceName1 exists now
    const resource1GetResponse = await api.GET(
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

    expect(resource1GetResponse.response.status).toBe(200);
    expect(resource1GetResponse.data?.metadata?.["e2e-test"]).toBe("updated");

    // Verify resourceName2 was deleted (should return 404)
    const resource2GetResponse = await api.GET(
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

    expect(resource2GetResponse.response.status).toBe(404);

    // Verify resourceName3 was deleted (should return 404)
    const resource3GetResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: resourceName3,
          },
        },
      },
    );

    expect(resource3GetResponse.response.status).toBe(404);
  });

  test("delete all resources for a provider", async ({ api, workspace }) => {
    // Create a resource provider
    const providerName = faker.string.alphanumeric(10);

    // Get the provider ID
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
    const providerId = providerResponse.data?.id as string;

    // Create initial resources
    const resourceName1 = faker.string.alphanumeric(10);
    const resourceName2 = faker.string.alphanumeric(10);

    // Set the initial resources
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
            },
          ],
        },
      },
    );

    expect(setResponse.data?.resources?.ignored?.length).toBe(0);
    expect(setResponse.data?.resources?.inserted?.length).toBe(2);
    expect(setResponse.data?.resources?.updated?.length).toBe(0);
    expect(setResponse.data?.resources?.deleted?.length).toBe(0);

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

    // Now update with an empty resources array to delete all resources
    const deleteAllResponse = await api.PATCH(
      "/v1/resource-providers/{providerId}/set",
      {
        params: {
          path: { providerId },
        },
        body: {
          resources: [],
        },
      },
    );

    expect(deleteAllResponse.response.status).toBe(200);
    expect(deleteAllResponse.data?.resources?.ignored?.length).toBe(0);
    expect(deleteAllResponse.data?.resources?.inserted?.length).toBe(0);
    expect(deleteAllResponse.data?.resources?.updated?.length).toBe(0);
    expect(deleteAllResponse.data?.resources?.deleted?.length).toBe(2);

    // Allow some time for deletion to be processed
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify both resources were deleted
    const resource1GetResponse = await api.GET(
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
    expect(resource1GetResponse.response.status).toBe(404);

    const resource2GetResponse = await api.GET(
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
    expect(resource2GetResponse.response.status).toBe(404);
  });

  test("ignore resources owned by other providers", async ({
    api,
    workspace,
  }) => {
    // Create two resource providers
    const provider1Name = faker.string.alphanumeric(10);
    const provider2Name = faker.string.alphanumeric(10);

    // Get provider IDs
    const provider1Response = await api.GET(
      "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            name: provider1Name,
          },
        },
      },
    );

    const provider2Response = await api.GET(
      "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            name: provider2Name,
          },
        },
      },
    );

    expect(provider1Response.response.status).toBe(200);
    expect(provider2Response.response.status).toBe(200);
    const provider1Id = provider1Response.data?.id as string;
    const provider2Id = provider2Response.data?.id as string;

    // Create a resource with provider1
    const resourceName = faker.string.alphanumeric(10);

    const provider1SetResponse = await api.PATCH(
      "/v1/resource-providers/{providerId}/set",
      {
        params: {
          path: { providerId: provider1Id },
        },
        body: {
          resources: [
            {
              name: resourceName,
              kind: "ProviderTest",
              identifier: resourceName,
              version: "test-version/v1",
              config: { "e2e-test": true } as any,
              metadata: { owner: "provider1" },
            },
          ],
        },
      },
    );

    expect(provider1SetResponse.response.status).toBe(200);
    expect(provider1SetResponse.data?.resources?.ignored?.length).toBe(0);
    expect(provider1SetResponse.data?.resources?.inserted?.length).toBe(1);
    expect(provider1SetResponse.data?.resources?.updated?.length).toBe(0);
    expect(provider1SetResponse.data?.resources?.deleted?.length).toBe(0);

    // Verify resource was created with provider1 as its provider
    const resourceResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: resourceName,
          },
        },
      },
    );

    expect(resourceResponse.response.status).toBe(200);
    expect(resourceResponse.data?.metadata?.owner).toBe("provider1");
    expect(resourceResponse.data?.providerId).toBe(provider1Id);

    // Now try to update the same resource with provider2
    const provider2SetResponse = await api.PATCH(
      "/v1/resource-providers/{providerId}/set",
      {
        params: {
          path: { providerId: provider2Id },
        },
        body: {
          resources: [
            {
              name: resourceName,
              kind: "ProviderTest",
              identifier: resourceName,
              version: "test-version/v1",
              config: { "e2e-test": true } as any,
              metadata: { owner: "provider2" }, // Try to change metadata
            },
          ],
        },
      },
    );

    expect(provider2SetResponse.response.status).toBe(200);
    expect(provider2SetResponse.data?.resources?.ignored?.length).toBe(1);
    expect(provider2SetResponse.data?.resources?.inserted?.length).toBe(0);
    expect(provider2SetResponse.data?.resources?.updated?.length).toBe(0);
    expect(provider2SetResponse.data?.resources?.deleted?.length).toBe(0);

    // Verify that the resource was ignored and still belongs to provider1
    const resourceUpdatedResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: resourceName,
          },
        },
      },
    );

    expect(resourceUpdatedResponse.response.status).toBe(200);
    expect(resourceUpdatedResponse.data?.metadata?.owner).toBe("provider1"); // Should still be provider1
    expect(resourceUpdatedResponse.data?.providerId).toBe(provider1Id); // Should still be provider1Id

    // Check that the response contains the resource in the ignored list
    expect(provider2SetResponse.data?.resources?.ignored).toBeDefined();
    const ignoredResources = provider2SetResponse.data?.resources?.ignored;
    expect(Array.isArray(ignoredResources)).toBe(true);

    // Verify that our resource is in the ignored list
    const isResourceIgnored = ignoredResources?.some(
      (r: any) => r.identifier === resourceName,
    );
    expect(isResourceIgnored).toBe(true);
  });

  test("claim resources with null provider", async ({ api, workspace }) => {
    // Create a resource provider
    const providerName = faker.string.alphanumeric(10);

    // Get provider ID
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
    const providerId = providerResponse.data?.id as string;

    // First create a resource directly with null provider
    const resourceName = faker.string.alphanumeric(10);

    const createResponse = await api.POST("/v1/resources", {
      body: {
        workspaceId: workspace.id,
        name: resourceName,
        kind: "NullProviderTest",
        identifier: resourceName,
        version: "test-version/v1",
        config: { "e2e-test": true } as any,
        metadata: { provider: "null" },
      },
    });

    expect(createResponse.response.status).toBe(200);

    // Verify the resource was created with null provider
    const resourceResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: resourceName,
          },
        },
      },
    );

    expect(resourceResponse.response.status).toBe(200);
    // The direct creation should have null providerId
    expect(resourceResponse.data?.providerId).toBeNull();

    // Now have the provider claim this resource
    const setResponse = await api.PATCH(
      "/v1/resource-providers/{providerId}/set",
      {
        params: {
          path: { providerId },
        },
        body: {
          resources: [
            {
              name: resourceName,
              kind: "NullProviderTest",
              identifier: resourceName,
              version: "test-version/v1",
              config: { "e2e-test": true } as any,
              metadata: { provider: "claimed" }, // Update the metadata
            },
          ],
        },
      },
    );

    expect(setResponse.response.status).toBe(200);

    // Verify the resource now belongs to the provider
    const updatedResourceResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: resourceName,
          },
        },
      },
    );

    expect(updatedResourceResponse.response.status).toBe(200);
    expect(updatedResourceResponse.data?.providerId).toBe(providerId); // Should now have the providerId
    expect(updatedResourceResponse.data?.metadata?.provider).toBe("claimed"); // Metadata should be updated

    // Check that the response contains the resource in the updated list
    expect(setResponse.data?.resources?.updated).toBeDefined();
    const updatedResources = setResponse.data?.resources?.updated;
    expect(Array.isArray(updatedResources)).toBe(true);

    // Verify that our resource is in the updated list
    const isResourceUpdated = updatedResources?.some(
      (r: any) => r.identifier === resourceName,
    );
    expect(isResourceUpdated).toBe(true);
  });

  test("recreate deleted resources with different provider", async ({
    api,
    workspace,
  }) => {
    // Create first resource provider
    const provider1Name = faker.string.alphanumeric(10);
    const provider1Response = await api.GET(
      "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            name: provider1Name,
          },
        },
      },
    );
    expect(provider1Response.response.status).toBe(200);
    const provider1Id = provider1Response.data?.id as string;

    // Create second resource provider
    const provider2Name = faker.string.alphanumeric(10);
    const provider2Response = await api.GET(
      "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            name: provider2Name,
          },
        },
      },
    );
    expect(provider2Response.response.status).toBe(200);
    const provider2Id = provider2Response.data?.id as string;

    // Create a resource with the first provider
    const resourceIdentifier = faker.string.alphanumeric(10);
    const originalKind = "OriginalKind";
    const originalVersion = "original-version/v1";

    // Set resource with the first provider
    const provider1SetResponse = await api.PATCH(
      "/v1/resource-providers/{providerId}/set",
      {
        params: {
          path: { providerId: provider1Id },
        },
        body: {
          resources: [
            {
              name: resourceIdentifier,
              kind: originalKind,
              identifier: resourceIdentifier,
              version: originalVersion,
              config: { "e2e-test": true } as any,
              metadata: { provider: "provider1" },
            },
          ],
        },
      },
    );
    expect(provider1SetResponse.response.status).toBe(200);
    expect(provider1SetResponse.data?.resources?.inserted?.length).toBe(1);

    // Verify the resource was created
    const initialResourceResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: resourceIdentifier,
          },
        },
      },
    );
    expect(initialResourceResponse.response.status).toBe(200);
    expect(initialResourceResponse.data?.kind).toBe(originalKind);
    expect(initialResourceResponse.data?.version).toBe(originalVersion);
    expect(initialResourceResponse.data?.providerId).toBe(provider1Id);

    // Delete all resources for provider1 (simulating provider deletion)
    const deleteAllResponse = await api.PATCH(
      "/v1/resource-providers/{providerId}/set",
      {
        params: {
          path: { providerId: provider1Id },
        },
        body: {
          resources: [],
        },
      },
    );
    expect(deleteAllResponse.response.status).toBe(200);
    expect(deleteAllResponse.data?.resources?.deleted?.length).toBe(1);

    // Verify resource is deleted
    const deletedResourceResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: resourceIdentifier,
          },
        },
      },
    );
    expect(deletedResourceResponse.response.status).toBe(404);

    // Create the same resource with a different provider, kind, and version
    const newKind = "NewKind";
    const newVersion = "new-version/v2";

    const provider2SetResponse = await api.PATCH(
      "/v1/resource-providers/{providerId}/set",
      {
        params: {
          path: { providerId: provider2Id },
        },
        body: {
          resources: [
            {
              name: resourceIdentifier,
              kind: newKind,
              identifier: resourceIdentifier, // Same identifier as before
              version: newVersion,
              config: { "e2e-test": true } as any,
              metadata: { provider: "provider2" },
            },
          ],
        },
      },
    );
    expect(provider2SetResponse.response.status).toBe(200);
    expect(provider2SetResponse.data?.resources?.inserted?.length).toBe(1);
    expect(provider2SetResponse.data?.resources?.ignored?.length).toBe(0);

    // Verify the resource was recreated with the new properties
    const recreatedResourceResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: resourceIdentifier,
          },
        },
      },
    );
    expect(recreatedResourceResponse.response.status).toBe(200);
    expect(recreatedResourceResponse.data?.kind).toBe(newKind);
    expect(recreatedResourceResponse.data?.version).toBe(newVersion);
    expect(recreatedResourceResponse.data?.providerId).toBe(provider2Id);
    expect(recreatedResourceResponse.data?.metadata?.provider).toBe(
      "provider2",
    );
  });
});
