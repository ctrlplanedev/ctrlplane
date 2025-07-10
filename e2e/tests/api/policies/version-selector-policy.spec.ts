import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";
import { Client } from "openapi-fetch";

import { EntitiesBuilder } from "../../../api";
import { paths } from "../../../api/schema";
import { test } from "../../fixtures";

const yamlPath = path.join(__dirname, "version-selector-policy.spec.yaml");

const initDeployment = async (
  api: Client<paths, `${string}/${string}`>,
  builder: EntitiesBuilder,
) => {
  const systemId = builder.refs.system.id;
  const deploymentName = faker.string.alphanumeric(10);
  const deploymentResponse = await api.POST("/v1/deployments", {
    body: {
      name: deploymentName,
      slug: deploymentName,
      systemId,
    },
  });
  expect(deploymentResponse.data?.id).toBeDefined();
  return deploymentResponse.data!.id;
};

const initVersion = async (
  api: Client<paths, `${string}/${string}`>,
  versionTag: string,
  deploymentId: string,
) => {
  const versionResponse = await api.POST("/v1/deployment-versions", {
    body: {
      deploymentId,
      tag: versionTag,
    },
  });
  expect(versionResponse.data?.id).toBeDefined();
};

const getTestReleaseTarget = async (
  api: Client<paths, `${string}/${string}`>,
  builder: EntitiesBuilder,
  deploymentId: string,
) => {
  const resourceRef = builder.refs.takeResources(1)[0]!;
  const workspaceId = builder.workspace.id;

  const resourceResponse = await api.GET(
    "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
    {
      params: {
        path: {
          workspaceId,
          identifier: resourceRef.identifier,
        },
      },
    },
  );
  expect(resourceResponse.data?.id).toBeDefined();
  const resourceId = resourceResponse.data!.id;

  const releaseTargetsForResource = await api.GET(
    "/v1/resources/{resourceId}/release-targets",
    {
      params: {
        path: {
          resourceId,
        },
      },
    },
  );

  const environmentRef = builder.refs.takeEnvironments(1)[0]!;
  const environmentId = environmentRef.id;

  const releaseTarget = releaseTargetsForResource.data?.find(
    (rt) =>
      rt.environment.id === environmentId &&
      rt.deployment.id === deploymentId &&
      rt.resource.id === resourceId,
  );

  expect(releaseTarget).toBeDefined();
  return releaseTarget!;
};

const getReleasesForTarget = async (
  api: Client<paths, `${string}/${string}`>,
  releaseTargetId: string,
) => {
  const releasesResponse = await api.GET(
    "/v1/release-targets/{releaseTargetId}/releases",
    {
      params: {
        path: {
          releaseTargetId,
        },
      },
    },
  );

  return releasesResponse.data ?? [];
};

test.describe("Version selector policy", () => {
  let builder: EntitiesBuilder;

  test.beforeEach(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);
    await builder.upsertSystemFixture();
    await builder.upsertEnvironmentFixtures();
    await builder.upsertResourcesFixtures();
    await builder.upsertPolicyFixtures();
  });

  test("should create release for version matching policy selector", async ({
    api,
    page,
  }) => {
    const deploymentId = await initDeployment(api, builder);
    const versionTag = `${faker.string.alphanumeric(10)}-${builder.refs.prefix}`;
    await initVersion(api, versionTag, deploymentId);
    const releaseTarget = await getTestReleaseTarget(
      api,
      builder,
      deploymentId,
    );
    await page.waitForTimeout(10_000);
    const releases = await getReleasesForTarget(api, releaseTarget.id);

    const releaseForVersion = releases.find(
      ({ version }) => version.tag === versionTag,
    );
    expect(releaseForVersion).toBeDefined();
  });

  test("should not create release for version failing policy selector", async ({
    api,
    page,
  }) => {
    const deploymentId = await initDeployment(api, builder);
    const versionTag = faker.string.alphanumeric(10);
    await initVersion(api, versionTag, deploymentId);
    const releaseTarget = await getTestReleaseTarget(
      api,
      builder,
      deploymentId,
    );
    await page.waitForTimeout(10_000);
    const releases = await getReleasesForTarget(api, releaseTarget.id);

    const releaseForVersion = releases.find(
      ({ version }) => version.tag === versionTag,
    );
    expect(releaseForVersion).toBeUndefined();
  });
});
