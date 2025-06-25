import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";
import { Client } from "openapi-fetch";

import { cleanupImportedEntities, EntitiesBuilder, paths } from "../../../api";
import { test } from "../../fixtures";

const yamlPath = path.join(__dirname, "retry-policy.spec.yaml");

const initAgent = async (
  api: Client<paths, `${string}/${string}`>,
  builder: EntitiesBuilder,
) => {
  const agentName = faker.string.alphanumeric(10);
  const agentResponse = await api.PATCH("/v1/job-agents/name", {
    body: {
      name: agentName,
      type: "e2e-agent-type",
      workspaceId: builder.workspace.id,
    },
  });
  expect(agentResponse.data?.id).toBeDefined();
  return agentResponse.data?.id!;
};

const initDeployment = async (
  api: Client<paths, `${string}/${string}`>,
  builder: EntitiesBuilder,
  agentId: string,
) => {
  const systemId = builder.refs.system.id;
  const deploymentName = faker.string.alphanumeric(10);
  const deploymentResponse = await api.POST("/v1/deployments", {
    body: {
      name: deploymentName,
      slug: deploymentName,
      systemId,
      jobAgentId: agentId,
    },
  });
  expect(deploymentResponse.data?.id).toBeDefined();

  const versionTag = faker.string.alphanumeric(10);
  const versionResponse = await api.POST("/v1/deployment-versions", {
    body: {
      deploymentId: deploymentResponse.data?.id!,
      tag: versionTag,
    },
  });
  expect(versionResponse.data?.id).toBeDefined();
};

async function initTestEntities(
  api: Client<paths, `${string}/${string}`>,
  builder: EntitiesBuilder,
) {
  const agentId = await initAgent(api, builder);
  await initDeployment(api, builder, agentId);
  return agentId;
}

test.describe("Retry policy", () => {
  let builder: EntitiesBuilder;

  test.beforeEach(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);

    await builder.upsertSystemFixture();
    await builder.upsertResourcesFixtures();
    await builder.upsertEnvironmentFixtures();
    await builder.upsertPolicyFixtures();
  });

  test.afterEach(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.refs, workspace.id);
  });

  test("should retry job until max attempts is reached", async ({
    api,
    page,
  }) => {
    const agentId = await initTestEntities(api, builder);

    await page.waitForTimeout(1_000);
    const policyId = builder.refs.onePolicy().id;

    const policyResponse = await api.GET("/v1/policies/{policyId}", {
      params: {
        path: {
          policyId,
        },
      },
    });

    expect(policyResponse.data?.maxRetries).toBeDefined();
    console.log({ policyResponse });
    const maxRetries = policyResponse.data?.maxRetries!;
    expect(maxRetries).toBeGreaterThan(0);

    for (let i = 0; i < maxRetries; i++) {
      const jobResponse = await api.GET("/v1/job-agents/{agentId}/queue/next", {
        params: {
          path: {
            agentId,
          },
        },
      });

      console.log({ i, jobResponse });

      expect(jobResponse.response.ok).toBe(true);
      const nextJobs = jobResponse.data?.jobs;
      expect(nextJobs).toBeDefined();
      expect(nextJobs?.length).toBe(1);

      const nextJob = nextJobs?.[0];
      expect(nextJob).toBeDefined();
      expect(nextJob?.status).toBe("pending");

      await api.PATCH("/v1/jobs/{jobId}", {
        params: {
          path: {
            jobId: nextJob?.id!,
          },
        },
        body: {
          status: "failure",
        },
      });

      await page.waitForTimeout(2_000);
    }

    const jobResponse = await api.GET("/v1/job-agents/{agentId}/queue/next", {
      params: {
        path: {
          agentId,
        },
      },
    });

    expect(jobResponse.response.ok).toBe(true);
    const nextJobs = jobResponse.data?.jobs;
    expect(nextJobs).toBeDefined();
    expect(nextJobs?.length).toBe(0);
  });
});
