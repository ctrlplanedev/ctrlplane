import path from "path";
import { expect } from "@playwright/test";
import { Client } from "openapi-fetch";

import { cleanupImportedEntities, EntitiesBuilder, paths } from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "version-pinning.spec.yaml");

const getReleaseTargetId = async (
  api: Client<paths, `${string}/${string}`>,
  builder: EntitiesBuilder,
  workspaceId: string,
) => {
  const resource = builder.refs.oneResource();
  const { identifier } = resource;

  const resourceResponse = await api.GET(
    "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
    { params: { path: { workspaceId, identifier } } },
  );
  expect(resourceResponse.data?.id).toBeDefined();
  const resourceId = resourceResponse.data!.id;

  const releaseTargetResponse = await api.GET(
    "/v1/resources/{resourceId}/release-targets",
    { params: { path: { resourceId } } },
  );
  expect(releaseTargetResponse.data?.length).toBe(1);
  return releaseTargetResponse.data![0].id;
};

const validateLatestRelease = async (
  api: Client<paths, `${string}/${string}`>,
  releaseTargetId: string,
  expectedTag: string,
) => {
  const releaseResponse = await api.GET(
    "/v1/release-targets/{releaseTargetId}/releases",
    { params: { path: { releaseTargetId } } },
  );
  const latestRelease = releaseResponse.data![0];
  expect(latestRelease.version.tag).toBe(expectedTag);
};

test.describe("Version Pinning API", () => {
  let builder: EntitiesBuilder;

  test.beforeAll(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);
    await builder.upsertSystemFixture();
    await builder.upsertResourcesFixtures();
    await builder.upsertEnvironmentFixtures();
    await builder.upsertDeploymentFixtures();
    await builder.upsertDeploymentVersionFixtures();
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.refs, workspace.id);
  });

  test("should pin and unpin a version to a release target", async ({
    api,
    page,
    workspace,
  }) => {
    const releaseTargetId = await getReleaseTargetId(
      api,
      builder,
      workspace.id,
    );

    const pinResponse = await api.POST(
      "/v1/release-targets/{releaseTargetId}/pin",
      {
        params: { path: { releaseTargetId } },
        body: { versionTag: "2.0.0" },
      },
    );

    expect(pinResponse.response.status).toBe(200);
    expect(pinResponse.data?.success).toBe(true);

    await page.waitForTimeout(8_000);
    await validateLatestRelease(api, releaseTargetId, "2.0.0");

    const pinResponse2 = await api.POST(
      "/v1/release-targets/{releaseTargetId}/pin",
      { params: { path: { releaseTargetId } }, body: { versionTag: "1.0.0" } },
    );
    expect(pinResponse2.response.status).toBe(200);
    expect(pinResponse2.data?.success).toBe(true);

    await page.waitForTimeout(8_000);
    await validateLatestRelease(api, releaseTargetId, "1.0.0");

    const unpinResponse = await api.POST(
      "/v1/release-targets/{releaseTargetId}/unpin",
      { params: { path: { releaseTargetId } } },
    );

    expect(unpinResponse.response.status).toBe(200);
    expect(unpinResponse.data?.success).toBe(true);

    await page.waitForTimeout(8_000);
    await validateLatestRelease(api, releaseTargetId, "3.0.0");
  });
});
