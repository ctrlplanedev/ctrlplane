import path from "path";
import { expect } from "@playwright/test";

import { EntitiesBuilder } from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "resource-grouping.spec.yaml");

test.describe("Resource Provider API", () => {
  let builder: EntitiesBuilder;
  test.beforeAll(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);
    await builder.createSystem();
    await builder.createResources();
  });

  test("basic resource grouping", async ({ api, workspace }) => {
    const resources = await api.POST(
      "/v1/workspaces/{workspaceId}/resources/metadata-grouped-counts",
      {
        params: { path: { workspaceId: workspace.id } },
        body: {
          metadataKeys: ["group"],
          allowNullCombinations: false,
        },
      },
    );

    expect(resources.response.status).toBe(200);
    expect(resources.data?.keys).toEqual(["group"]);
    expect(resources.data?.combinations).toEqual([
      {
        metadata: { group: "a" },
        resources: 3,
      },
      {
        metadata: { group: "b" },
        resources: 2,
      },
      {
        metadata: { group: "c" },
        resources: 2,
      },
    ]);
  });

  test("multiple metadata keys", async ({ api, workspace }) => {
    const resources = await api.POST(
      "/v1/workspaces/{workspaceId}/resources/metadata-grouped-counts",
      {
        params: { path: { workspaceId: workspace.id } },
        body: {
          metadataKeys: ["group", "subgroup"],
          allowNullCombinations: false,
        },
      },
    );

    expect(resources.response.status).toBe(200);
    expect(resources.data?.keys).toEqual(["group", "subgroup"]);
    expect(resources.data?.combinations).toEqual([
      {
        metadata: { group: "a", subgroup: "a1" },
        resources: 2,
      },
      {
        metadata: { group: "a", subgroup: "a2" },
        resources: 1,
      },
      {
        metadata: { group: "b", subgroup: "b1" },
        resources: 2,
      },
    ]);
  });

  test("allow null combinations", async ({ api, workspace }) => {
    const resources = await api.POST(
      "/v1/workspaces/{workspaceId}/resources/metadata-grouped-counts",
      {
        params: { path: { workspaceId: workspace.id } },
        body: {
          metadataKeys: ["group", "subgroup"],
          allowNullCombinations: true,
        },
      },
    );

    expect(resources.response.status).toBe(200);
    expect(resources.data?.keys).toEqual(["group", "subgroup"]);
    expect(resources.data?.combinations.length).toBe(5);

    const groupCNullSubgroup = resources.data?.combinations.find(
      (c) => c.metadata.group === "c" && c.metadata.subgroup == null,
    );
    expect(groupCNullSubgroup?.resources).toBe(2);
  });
});
