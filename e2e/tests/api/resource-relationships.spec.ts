import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { cleanupImportedEntities, EntitiesBuilder } from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "resource-relationships.spec.yaml");

test.describe("Resource Relationships API", () => {
  let builder: EntitiesBuilder;
  let prefix: string;

  test.beforeAll(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);
    prefix = builder.refs.prefix;

    await builder.upsertSystemFixture();
    await builder.upsertResourcesFixtures();
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.refs, workspace.id);
  });

  test("create a relationship with metadata match", async ({
    api,
    workspace,
  }) => {
    const reference = `${prefix}-${faker.string.alphanumeric(
      10,
    )}`.toLocaleLowerCase();
    const resourceRelationship = await api.POST(
      "/v1/resource-relationship-rules",
      {
        body: {
          workspaceId: workspace.id,
          name: reference + "-resource-relationship-rule",
          reference,
          dependencyType: "depends_on",
          sourceKind: "Source",
          sourceVersion: `${prefix}-test-version/v1`,
          targetKind: "Target",
          targetVersion: `${prefix}-test-version/v1`,
          metadataKeysMatches: [{ sourceKey: prefix, targetKey: "e2e/test" }],
        },
      },
    );

    expect(resourceRelationship.response.status).toBe(200);

    const resourceRelationship2 = await api.POST(
      "/v1/resource-relationship-rules",
      {
        body: {
          workspaceId: workspace.id,
          name: reference + "-resource-relationship-rule",
          reference,
          dependencyType: "depends_on",
          sourceKind: "SecondarySource",
          sourceVersion: "test-version/v1",
          targetKind: "Target",
          targetVersion: "test-version/v1",
          metadataKeysMatches: [{ sourceKey: prefix, targetKey: "e2e/test" }],
        },
      },
    );

    expect(resourceRelationship2.response.status).toBe(200);

    const targetResource = await api.GET(
      `/v1/workspaces/{workspaceId}/resources/identifier/{identifier}`,
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: prefix + "-target-resource",
          },
        },
      },
    );

    expect(targetResource.response.status).toBe(200);
    expect(targetResource.data?.relationships).toBeDefined();
    const source = targetResource.data?.relationships?.[reference];
    expect(source).toBeDefined();
    expect(source?.type).toBe("depends_on");
    expect(source?.reference).toBe(reference);
    expect(source?.source?.id).toBeDefined();
    expect(source?.source?.name).toBeDefined();
    expect(source?.source?.version).toBeDefined();
    expect(source?.source?.kind).toBeDefined();
    expect(source?.source?.identifier).toBeDefined();
    expect(source?.source?.config).toBeDefined();
  });

  test("create a relationship with source metadata equals", async ({
    api,
    workspace,
  }) => {
    const reference = `${prefix}-${faker.string.alphanumeric(
      10,
    )}`.toLocaleLowerCase();
    const resourceRelationship = await api.POST(
      "/v1/resource-relationship-rules",
      {
        body: {
          workspaceId: workspace.id,
          name: reference + "-resource-relationship-rule",
          reference,
          dependencyType: "depends_on",
          sourceKind: "Source",
          sourceVersion: `${prefix}-test-version/v1`,
          targetKind: "Target",
          targetVersion: `${prefix}-test-version/v1`,
          targetMetadataEquals: [{ key: prefix, value: "true" }],
        },
      },
    );

    expect(resourceRelationship.response.status).toBe(200);

    const targetResource = await api.GET(
      `/v1/workspaces/{workspaceId}/resources/identifier/{identifier}`,
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: prefix + "-target-resource",
          },
        },
      },
    );

    expect(targetResource.response.status).toBe(200);
    expect(targetResource.data?.relationships).toBeDefined();
    const source = targetResource.data?.relationships?.[reference];
    expect(source).toBeDefined();
    expect(source?.type).toBe("depends_on");
    expect(source?.reference).toBe(reference);
    expect(source?.source?.id).toBeDefined();
    expect(source?.source?.name).toBeDefined();
    expect(source?.source?.version).toBeDefined();
    expect(source?.source?.kind).toBeDefined();
    expect(source?.source?.identifier).toBeDefined();
    expect(source?.source?.config).toBeDefined();
  });

  test("create a relationship with target metadata equals", async ({
    api,
    workspace,
  }) => {
    const reference = `${prefix}-${faker.string.alphanumeric(
      10,
    )}`.toLocaleLowerCase();
    const resourceRelationship = await api.POST(
      "/v1/resource-relationship-rules",
      {
        body: {
          workspaceId: workspace.id,
          name: reference + "-resource-relationship-rule",
          reference,
          dependencyType: "depends_on",
          sourceKind: "Source",
          sourceVersion: `${prefix}-test-version/v1`,
          targetKind: "Target",
          targetVersion: `${prefix}-test-version/v1`,
          sourceMetadataEquals: [{ key: prefix, value: "true" }],
        },
      },
    );

    expect(resourceRelationship.response.status).toBe(200);

    const targetResource = await api.GET(
      `/v1/workspaces/{workspaceId}/resources/identifier/{identifier}`,
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: prefix + "-target-resource",
          },
        },
      },
    );

    expect(targetResource.response.status).toBe(200);
    expect(targetResource.data?.relationships).toBeDefined();
    const target = targetResource.data?.relationships?.[reference];
    expect(target).toBeDefined();
    expect(target?.type).toBe("depends_on");
    expect(target?.reference).toBe(reference);
    expect(target?.source?.id).toBeDefined();
    expect(target?.source?.name).toBeDefined();
    expect(target?.source?.version).toBeDefined();
    expect(target?.source?.kind).toBeDefined();
    expect(target?.source?.identifier).toBeDefined();
    expect(target?.source?.config).toBeDefined();
  });

  test("create a relationship rule where target version is not specified", async ({
    api,
    workspace,
  }) => {
    const reference =
      `${prefix}-${faker.string.alphanumeric(10)}`.toLocaleLowerCase();

    const resourceRelationship = await api.POST(
      "/v1/resource-relationship-rules",
      {
        body: {
          workspaceId: workspace.id,
          name: reference + "-resource-relationship-rule",
          reference,
          dependencyType: "depends_on",
          sourceKind: "Source",
          sourceVersion: `${prefix}-test-version/v1`,
          targetKind: "Target",
        },
      },
    );

    expect(resourceRelationship.response.status).toBe(200);

    const targetResource = await api.GET(
      `/v1/workspaces/{workspaceId}/resources/identifier/{identifier}`,
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: prefix + "-target-resource",
          },
        },
      },
    );

    expect(targetResource.response.status).toBe(200);
    expect(targetResource.data?.relationships).toBeDefined();
    const source = targetResource.data?.relationships?.[reference];
    expect(source).toBeDefined();
    expect(source?.type).toBe("depends_on");
    expect(source?.reference).toBe(reference);
    expect(source?.source?.id).toBeDefined();
    expect(source?.source?.name).toBeDefined();
    expect(source?.source?.version).toBeDefined();
    expect(source?.source?.kind).toBeDefined();
    expect(source?.source?.identifier).toBeDefined();
    expect(source?.source?.config).toBeDefined();
  });

  test("create a relationship rule where target kind is not specified", async ({
    api,
    workspace,
  }) => {
    const reference =
      `${prefix}-${faker.string.alphanumeric(10)}`.toLocaleLowerCase();

    const resourceRelationship = await api.POST(
      "/v1/resource-relationship-rules",
      {
        body: {
          workspaceId: workspace.id,
          name: reference + "-resource-relationship-rule",
          reference,
          dependencyType: "depends_on",
          sourceKind: "Source",
          sourceVersion: `${prefix}-test-version/v1`,
          targetVersion: `${prefix}-test-version/v1`,
        },
      },
    );

    expect(resourceRelationship.response.status).toBe(200);

    const targetResource = await api.GET(
      `/v1/workspaces/{workspaceId}/resources/identifier/{identifier}`,
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: prefix + "-target-resource",
          },
        },
      },
    );

    expect(targetResource.response.status).toBe(200);
    expect(targetResource.data?.relationships).toBeDefined();
    const source = targetResource.data?.relationships?.[reference];
    expect(source).toBeDefined();
    expect(source?.type).toBe("depends_on");
    expect(source?.reference).toBe(reference);
    expect(source?.source?.id).toBeDefined();
    expect(source?.source?.name).toBeDefined();
    expect(source?.source?.version).toBeDefined();
    expect(source?.source?.kind).toBeDefined();
    expect(source?.source?.identifier).toBeDefined();
    expect(source?.source?.config).toBeDefined();

    const targetResource2 = await api.GET(
      `/v1/workspaces/{workspaceId}/resources/identifier/{identifier}`,
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: prefix + "-secondary-target-resource",
          },
        },
      },
    );

    expect(targetResource2.response.status).toBe(200);
    expect(targetResource2.data?.relationships).toBeDefined();
    const source2 = targetResource2.data?.relationships?.[reference];
    expect(source2).toBeDefined();
    expect(source2?.type).toBe("depends_on");
    expect(source2?.reference).toBe(reference);
    expect(source2?.source?.id).toBeDefined();
    expect(source2?.source?.name).toBeDefined();
    expect(source2?.source?.version).toBeDefined();
    expect(source2?.source?.kind).toBeDefined();
    expect(source2?.source?.identifier).toBeDefined();
    expect(source2?.source?.config).toBeDefined();
  });

  test("create a relationship rule where neither target kind nor version is specified", async ({
    api,
    workspace,
  }) => {
    const reference =
      `${prefix}-${faker.string.alphanumeric(10)}`.toLocaleLowerCase();

    const resourceRelationship = await api.POST(
      "/v1/resource-relationship-rules",
      {
        body: {
          workspaceId: workspace.id,
          name: reference + "-resource-relationship-rule",
          reference,
          dependencyType: "depends_on",
          sourceKind: "Source",
          sourceVersion: `${prefix}-test-version/v1`,
        },
      },
    );

    expect(resourceRelationship.response.status).toBe(200);

    const targetResource = await api.GET(
      `/v1/workspaces/{workspaceId}/resources/identifier/{identifier}`,
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: prefix + "-target-resource",
          },
        },
      },
    );

    expect(targetResource.response.status).toBe(200);
    expect(targetResource.data?.relationships).toBeDefined();
    const source = targetResource.data?.relationships?.[reference];
    expect(source).toBeDefined();
    expect(source?.type).toBe("depends_on");
    expect(source?.reference).toBe(reference);
    expect(source?.source?.id).toBeDefined();
    expect(source?.source?.name).toBeDefined();
    expect(source?.source?.version).toBeDefined();
    expect(source?.source?.kind).toBeDefined();
    expect(source?.source?.identifier).toBeDefined();
    expect(source?.source?.config).toBeDefined();

    const targetResource2 = await api.GET(
      `/v1/workspaces/{workspaceId}/resources/identifier/{identifier}`,
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: prefix + "-secondary-target-resource",
          },
        },
      },
    );

    expect(targetResource2.response.status).toBe(200);
    expect(targetResource2.data?.relationships).toBeDefined();
    const source2 = targetResource2.data?.relationships?.[reference];
    expect(source2).toBeDefined();
    expect(source2?.type).toBe("depends_on");
    expect(source2?.reference).toBe(reference);
    expect(source2?.source?.id).toBeDefined();
    expect(source2?.source?.name).toBeDefined();
    expect(source2?.source?.version).toBeDefined();
    expect(source2?.source?.kind).toBeDefined();
    expect(source2?.source?.identifier).toBeDefined();
    expect(source2?.source?.config).toBeDefined();

    const targetResource3 = await api.GET(
      `/v1/workspaces/{workspaceId}/resources/identifier/{identifier}`,
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: prefix + "-different-version-kind-target-resource",
          },
        },
      },
    );

    expect(targetResource3.response.status).toBe(200);
    expect(targetResource3.data?.relationships).toBeDefined();
    const source3 = targetResource3.data?.relationships?.[reference];
    expect(source3).toBeDefined();
    expect(source3?.type).toBe("depends_on");
    expect(source3?.reference).toBe(reference);
    expect(source3?.source?.id).toBeDefined();
    expect(source3?.source?.name).toBeDefined();
    expect(source3?.source?.version).toBeDefined();
    expect(source3?.source?.kind).toBeDefined();
    expect(source3?.source?.identifier).toBeDefined();
    expect(source3?.source?.config).toBeDefined();
  });

  test("upsert a relationship rule", async ({ api, workspace }) => {
    const reference = `${prefix}-${faker.string.alphanumeric(
      10,
    )}`.toLocaleLowerCase();
    // First create a new relationship rule
    const initialRule = await api.POST("/v1/resource-relationship-rules", {
      body: {
        workspaceId: workspace.id,
        name: prefix + "-upsert-rule",
        reference,
        dependencyType: "depends_on",
        sourceKind: "SourceA",
        sourceVersion: `${prefix}-test-version/v1`,
        targetKind: "TargetA",
        targetVersion: `${prefix}-test-version/v1`,
        description: "Initial description",
        metadataKeysMatches: [{ sourceKey: prefix, targetKey: "e2e/test" }],
      },
    });

    expect(initialRule.response.status).toBe(200);
    expect(initialRule.data?.name).toBe(prefix + "-upsert-rule");
    expect(initialRule.data?.sourceKind).toBe("SourceA");
    expect(initialRule.data?.targetKind).toBe("TargetA");

    const ruleId = initialRule.data?.id ?? "";

    // Update the existing rule with new properties
    const updatedRule = await api.PATCH(
      "/v1/resource-relationship-rules/{ruleId}",
      {
        params: {
          path: {
            ruleId: ruleId,
          },
        },
        body: {
          sourceKind: "SourceB",
          sourceVersion: "test-version/v2",
          targetKind: "TargetB",
          targetVersion: "test-version/v2",
          description: "Updated description",
          metadataKeysMatches: [
            { sourceKey: "e2e/test", targetKey: "additional-key" },
          ],
        },
      },
    );

    expect(updatedRule.response.status).toBe(200);
    expect(updatedRule.data?.id).toBe(initialRule.data?.id); // Should maintain same ID
    expect(updatedRule.data?.name).toBe(prefix + "-upsert-rule");
    expect(updatedRule.data?.sourceKind).toBe("SourceB");
    expect(updatedRule.data?.sourceVersion).toBe("test-version/v2");
    expect(updatedRule.data?.targetKind).toBe("TargetB");
    expect(updatedRule.data?.targetVersion).toBe("test-version/v2");
    expect(updatedRule.data?.description).toBe("Updated description");
  });

  test("should not match if some rules are not satisfied", async ({
    api,
    workspace,
  }) => {
    const reference = `${prefix}-${faker.string.alphanumeric(
      10,
    )}`.toLocaleLowerCase();

    const targetResourceCreate = await api.POST("/v1/resources", {
      body: {
        workspaceId: workspace.id,
        name: prefix + "-target-resource",
        kind: "Target",
        identifier: prefix + "-target-resource",
        version: `${prefix}-version/v1`,
        config: {},
        metadata: {
          "e2e/test": "true",
          "e2e/test2": "true",
        },
      },
    });

    expect(targetResourceCreate.response.status).toBe(200);

    const sourceResourceCreate = await api.POST("/v1/resources", {
      body: {
        workspaceId: workspace.id,
        name: prefix + "-target-resource",
        kind: "Target",
        identifier: prefix + "-target-resource",
        version: `${prefix}-version/v1`,
        config: {},
        metadata: {
          "e2e/test": "true",
          "e2e/test2": "false",
        },
      },
    });

    expect(sourceResourceCreate.response.status).toBe(200);

    const relationshipRule = await api.POST("/v1/resource-relationship-rules", {
      body: {
        workspaceId: workspace.id,
        name: prefix + "-relationship-rule",
        reference,
        dependencyType: "depends_on",
        sourceKind: "Source",
        sourceVersion: `${prefix}-version/v1`,
        targetKind: "Target",
        targetVersion: `${prefix}-version/v1`,
        metadataKeysMatches: [
          { sourceKey: "e2e/test", targetKey: "e2e/test" },
          { sourceKey: "e2e/test2", targetKey: "e2e/test2" },
        ],
      },
    });

    expect(relationshipRule.response.status).toBe(200);

    const targetResource = await api.GET(
      `/v1/workspaces/{workspaceId}/resources/identifier/{identifier}`,
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: prefix + "-source-resource",
          },
        },
      },
    );

    expect(targetResource.response.status).toBe(200);
    expect(targetResource.data?.relationships).toBeDefined();
    const target = targetResource.data?.relationships?.[reference];
    expect(target).toBeUndefined();
  });
});
