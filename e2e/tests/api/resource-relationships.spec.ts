import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import {
  cleanupImportedEntities,
  ImportedEntities,
  importEntitiesFromYaml,
} from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "resource-relationships.spec.yaml");

test.describe("Resource Relationships API", () => {
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

  test("create a relationship with metadata match", async ({
    api,
    workspace,
  }) => {
    const reference = `${importedEntities.prefix}-${faker.string.alphanumeric(10)}`;
    const resourceRelationship = await api.POST(
      "/v1/resource-relationship-rules",
      {
        body: {
          workspaceId: workspace.id,
          name: reference + "-resource-relationship-rule",
          reference,
          dependencyType: "depends_on",
          sourceKind: "Source",
          sourceVersion: "test-version/v1",
          targetKind: "Target",
          targetVersion: "test-version/v1",
          metadataKeysMatch: ["e2e/test", importedEntities.prefix],
        },
      },
    );

    expect(resourceRelationship.response.status).toBe(200);

    const sourceResource = await api.GET(
      `/v1/workspaces/{workspaceId}/resources/identifier/{identifier}`,
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: importedEntities.prefix + "-source-resource",
          },
        },
      },
    );

    expect(sourceResource.response.status).toBe(200);
    expect(sourceResource.data?.relationships).toBeDefined();
    const target = sourceResource.data?.relationships?.[reference];
    expect(target).toBeDefined();
    expect(target?.type).toBe("depends_on");
    expect(target?.reference).toBe(reference);
    expect(target?.target?.id).toBeDefined();
    expect(target?.target?.name).toBeDefined();
    expect(target?.target?.version).toBeDefined();
    expect(target?.target?.kind).toBeDefined();
    expect(target?.target?.identifier).toBeDefined();
    expect(target?.target?.config).toBeDefined();
  });

  test("create a relationship with metadata equals", async ({
    api,
    workspace,
  }) => {
    const reference = `${importedEntities.prefix}-${faker.string.alphanumeric(10)}`;
    const resourceRelationship = await api.POST(
      "/v1/resource-relationship-rules",
      {
        body: {
          workspaceId: workspace.id,
          name: reference + "-resource-relationship-rule",
          reference,
          dependencyType: "depends_on",
          sourceKind: "Source",
          sourceVersion: "test-version/v1",
          targetKind: "Target",
          targetVersion: "test-version/v1",
          metadataTargetKeysEquals: [
            { key: importedEntities.prefix, value: "true" },
          ],
        },
      },
    );

    expect(resourceRelationship.response.status).toBe(200);

    const sourceResource = await api.GET(
      `/v1/workspaces/{workspaceId}/resources/identifier/{identifier}`,
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: importedEntities.prefix + "-source-resource",
          },
        },
      },
    );

    expect(sourceResource.response.status).toBe(200);
    expect(sourceResource.data?.relationships).toBeDefined();
    const target = sourceResource.data?.relationships?.[reference];
    expect(target).toBeDefined();
    expect(target?.type).toBe("depends_on");
    expect(target?.reference).toBe(reference);
    expect(target?.target?.id).toBeDefined();
    expect(target?.target?.name).toBeDefined();
    expect(target?.target?.version).toBeDefined();
    expect(target?.target?.kind).toBeDefined();
    expect(target?.target?.identifier).toBeDefined();
    expect(target?.target?.config).toBeDefined();
  });

  test("upsert a relationship rule", async ({ api, workspace }) => {
    // First create a new relationship rule
    const initialRule = await api.POST("/v1/resource-relationship-rules", {
      body: {
        workspaceId: workspace.id,
        name: importedEntities.prefix + "-upsert-rule",
        reference: importedEntities.prefix + "-upsert",
        dependencyType: "depends_on",
        sourceKind: "SourceA",
        sourceVersion: "test-version/v1",
        targetKind: "TargetA",
        targetVersion: "test-version/v1",
        description: "Initial description",
        metadataKeysMatch: ["e2e/test"],
      },
    });

    expect(initialRule.response.status).toBe(200);
    expect(initialRule.data?.name).toBe(
      importedEntities.prefix + "-upsert-rule",
    );
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
          metadataKeysMatch: ["e2e/test", "additional-key"],
        },
      },
    );

    expect(updatedRule.response.status).toBe(200);
    expect(updatedRule.data?.id).toBe(initialRule.data?.id); // Should maintain same ID
    expect(updatedRule.data?.name).toBe(
      importedEntities.prefix + "-upsert-rule",
    );
    expect(updatedRule.data?.sourceKind).toBe("SourceB");
    expect(updatedRule.data?.sourceVersion).toBe("test-version/v2");
    expect(updatedRule.data?.targetKind).toBe("TargetB");
    expect(updatedRule.data?.targetVersion).toBe("test-version/v2");
    expect(updatedRule.data?.description).toBe("Updated description");
  });
});
