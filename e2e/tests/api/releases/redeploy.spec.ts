import path from "path";
import { expect } from "@playwright/test";
import { Client } from "openapi-fetch";

import { cleanupImportedEntities, EntitiesBuilder, paths } from "../../../api";
import { test } from "../../fixtures";

const yamlPath = path.join(__dirname, "redeploy.spec.yaml");

test.describe("Release Redeploy API", () => {
  let builder: EntitiesBuilder;

  test.beforeAll(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);
    await builder.upsertSystemFixture();
    await builder.upsertResourcesFixtures();
    await builder.upsertEnvironmentFixtures();
    await builder.upsertDeploymentFixtures();
    await builder.upsertAgentFixtures();
    const agentId = builder.refs.getAgentLike("agent").id;
    await builder.upsertDeploymentFixtures(agentId);
    await builder.upsertDeploymentVersionFixtures();
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.refs, workspace.id);
  });

  const getReleaseTarget = async (
    api: Client<paths, `${string}/${string}`>,
    builder: EntitiesBuilder,
  ) => {
    const resourceRef = builder.refs.oneResource();
    const { identifier } = resourceRef;
    const workspaceId = builder.workspace.id;

    const resourceResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      { params: { path: { workspaceId, identifier } } },
    );
    expect(resourceResponse.response.status).toBe(200);
    const resourceId = resourceResponse.data?.id;
    expect(resourceId).toBeDefined();

    const releaseTargetsResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      { params: { path: { resourceId: resourceId ?? "" } } },
    );
    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTarget = releaseTargetsResponse.data?.[0];
    expect(releaseTarget).toBeDefined();
    return releaseTarget!;
  };

  const getNextJob = async (
    api: Client<paths, `${string}/${string}`>,
    builder: EntitiesBuilder,
  ) => {
    const agentId = builder.refs.getAgentLike("agent").id;
    const nextJobResponse = await api.GET(
      "/v1/job-agents/{agentId}/queue/next",
      { params: { path: { agentId } } },
    );
    expect(nextJobResponse.response.status).toBe(200);
    const nextJobId = nextJobResponse.data?.jobs?.[0]?.id;
    expect(nextJobId).toBeDefined();

    const fullJob = await api.GET("/v1/jobs/{jobId}", {
      params: { path: { jobId: nextJobId ?? "" } },
    });
    expect(fullJob.response.status).toBe(200);
    expect(fullJob.data).toBeDefined();
    return fullJob.data!;
  };

  const getReleases = async (
    api: Client<paths, `${string}/${string}`>,
    releaseTargetId: string,
  ) => {
    const releasesResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      { params: { path: { releaseTargetId } } },
    );
    expect(releasesResponse.response.status).toBe(200);
    return releasesResponse.data ?? [];
  };

  test("should redeploy a release", async ({ api, page, workspace }) => {
    await page.waitForTimeout(5_000);
    const releaseTarget = await getReleaseTarget(api, builder);
    const releases = await getReleases(api, releaseTarget.id);
    expect(releases.length).toBe(1);
    const release = releases[0];
    expect(release).toBeDefined();
    expect(release.version.tag).toBe("1.0.0");

    const nextJob = await getNextJob(api, builder);
    expect(nextJob).toBeDefined();
    expect(nextJob.version?.tag).toBe("1.0.0");
    expect(nextJob.deployment?.id).toBe(releaseTarget.deployment.id);

    const successfulJobResponse = await api.PATCH("/v1/jobs/{jobId}", {
      params: { path: { jobId: nextJob.id ?? "" } },
      body: { status: "successful" },
    });
    expect(successfulJobResponse.response.status).toBe(200);

    const redeployResponse = await api.POST(
      "/v1/release-targets/{releaseTargetId}/redeploy",
      { params: { path: { releaseTargetId: releaseTarget.id } } },
    );
    expect(redeployResponse.response.status).toBe(200);

    await page.waitForTimeout(5_000);

    const redeployedJob = await getNextJob(api, builder);
    expect(redeployedJob).toBeDefined();
    expect(redeployedJob.version?.tag).toBe("1.0.0");
    expect(redeployedJob.deployment?.id).toBe(releaseTarget.deployment.id);
  });
});
