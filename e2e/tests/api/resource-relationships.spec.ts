import path from "path";
import { expect } from "@playwright/test";

import { ImportedEntities, importEntitiesFromYaml } from "../../api";
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

  test("create a relationship", async ({ api, workspace }) => {
    const resourceRelationship = await api.POST(
      "/v1/resource-relationship-rules",
      {
        body: {
          workspaceId: workspace.id,
          name: importedEntities.prefix + "-resource-relationship-rule",
          reference: importedEntities.prefix,
          dependencyType: "depends_on",
          sourceKind: "Source",
          sourceVersion: "test-version/v1",
          targetKind: "Target",
          targetVersion: "test-version/v1",
          metadataKeysMatch: ["e2e/test", importedEntities.prefix],
        },
      },
    );

    console.log(JSON.stringify(resourceRelationship.data, null, 2));
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
    const target =
      sourceResource.data?.relationships?.[importedEntities.prefix];
    expect(target).toBeDefined();
    expect(target?.type).toBe("depends_on");
    expect(target?.reference).toBe(importedEntities.prefix);
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

    // Update the existing rule with new properties
    const updatedRule = await api.POST("/v1/resource-relationship-rules", {
      body: {
        workspaceId: workspace.id,
        name: importedEntities.prefix + "-upsert-rule", // Same name for upsert
        reference: importedEntities.prefix + "-upsert",
        dependencyType: "depends_on",
        sourceKind: "SourceB",
        sourceVersion: "test-version/v2",
        targetKind: "TargetB",
        targetVersion: "test-version/v2",
        description: "Updated description",
        metadataKeysMatch: ["e2e/test", "additional-key"],
      },
    });

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
