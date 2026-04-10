import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";
import { v4 as uuidv4 } from "uuid";

import { test } from "../../fixtures";

test.describe("Policy API", () => {
  test("should create a policy and retrieve it", async ({ api, workspace }) => {
    const name = `policy-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST("/v1/workspaces/{workspaceId}/policies", {
      params: { path: { workspaceId: workspace.id } },
      body: {
        name,
        description: "Test policy",
        priority: 10,
        enabled: true,
        selector: "true",
        rules: [],
      },
    });

    expect(createRes.response.status).toBe(202);
    const policyId = createRes.data!.id;
    expect(createRes.data!.name).toBe(name);
    expect(createRes.data!.description).toBe("Test policy");
    expect(createRes.data!.priority).toBe(10);
    expect(createRes.data!.enabled).toBe(true);
    expect(createRes.data!.selector).toBe("true");
    expect(createRes.data!.workspaceId).toBe(workspace.id);

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.id).toBe(policyId);
    expect(getRes.data!.name).toBe(name);
    expect(getRes.data!.description).toBe("Test policy");
    expect(getRes.data!.priority).toBe(10);
    expect(getRes.data!.enabled).toBe(true);

    await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
    });
  });

  test("should create a policy with default values", async ({
    api,
    workspace,
  }) => {
    const name = `policy-defaults-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST("/v1/workspaces/{workspaceId}/policies", {
      params: { path: { workspaceId: workspace.id } },
      body: { name, rules: [] },
    });

    expect(createRes.response.status).toBe(202);
    const policyId = createRes.data!.id;
    expect(createRes.data!.priority).toBe(0);
    expect(createRes.data!.enabled).toBe(true);
    expect(createRes.data!.selector).toBe("true");
    expect(createRes.data!.metadata).toEqual({});

    await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
    });
  });

  test("should create a policy with metadata", async ({ api, workspace }) => {
    const name = `policy-meta-${faker.string.alphanumeric(8)}`;
    const metadata = { team: "platform", env: "production" };
    const createRes = await api.POST("/v1/workspaces/{workspaceId}/policies", {
      params: { path: { workspaceId: workspace.id } },
      body: { name, metadata, rules: [] },
    });

    expect(createRes.response.status).toBe(202);
    const policyId = createRes.data!.id;
    expect(createRes.data!.metadata).toEqual(metadata);

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.metadata).toEqual(metadata);

    await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
    });
  });

  test("should upsert (create) a policy with a specific ID", async ({
    api,
    workspace,
  }) => {
    const policyId = uuidv4();
    const name = `policy-upsert-${faker.string.alphanumeric(8)}`;

    const upsertRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
        body: {
          name,
          priority: 5,
          enabled: true,
          selector: "true",
          rules: [],
          metadata: {},
        },
      },
    );

    expect(upsertRes.response.status).toBe(202);
    expect(upsertRes.data!.id).toBe(policyId);
    expect(upsertRes.data!.name).toBe(name);

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.id).toBe(policyId);

    await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
    });
  });

  test("should update a policy via upsert", async ({ api, workspace }) => {
    const policyId = uuidv4();
    const name = `policy-update-${faker.string.alphanumeric(8)}`;

    await api.PUT("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
      body: {
        name,
        priority: 1,
        enabled: true,
        selector: "true",
        rules: [],
        metadata: {},
      },
    });

    const updatedName = `${name}-updated`;
    const upsertRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
        body: {
          name: updatedName,
          priority: 99,
          enabled: false,
          selector: "false",
          rules: [],
          metadata: {},
        },
      },
    );

    expect(upsertRes.response.status).toBe(202);

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.name).toBe(updatedName);
    expect(getRes.data!.priority).toBe(99);
    expect(getRes.data!.enabled).toBe(false);
    expect(getRes.data!.selector).toBe("false");

    await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
    });
  });

  test("should delete a policy", async ({ api, workspace }) => {
    const name = `policy-delete-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST("/v1/workspaces/{workspaceId}/policies", {
      params: { path: { workspaceId: workspace.id } },
      body: { name, rules: [] },
    });

    expect(createRes.response.status).toBe(202);
    const policyId = createRes.data!.id;

    const deleteRes = await api.DELETE(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
      },
    );

    expect(deleteRes.response.status).toBe(202);

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
      },
    );

    expect(getRes.response.status).toBe(404);
  });

  test("should return 404 for non-existent policy", async ({
    api,
    workspace,
  }) => {
    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: {
          path: { workspaceId: workspace.id, policyId: uuidv4() },
        },
      },
    );

    expect(getRes.response.status).toBe(404);
  });

  test("should return 400 for invalid policy ID in upsert", async ({
    api,
    workspace,
  }) => {
    const upsertRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: {
          path: { workspaceId: workspace.id, policyId: "not-a-uuid" },
        },
        body: {
          name: "test",
          priority: 0,
          enabled: true,
          selector: "true",
          rules: [],
          metadata: {},
        },
      },
    );

    expect(upsertRes.response.status).toBe(400);
  });

  test("should list policies", async ({ api, workspace }) => {
    const name = `policy-list-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST("/v1/workspaces/{workspaceId}/policies", {
      params: { path: { workspaceId: workspace.id } },
      body: { name, rules: [], metadata: {} },
    });

    expect(createRes.response.status).toBe(202);
    const policyId = createRes.data!.id;

    const listRes = await api.GET("/v1/workspaces/{workspaceId}/policies", {
      params: { path: { workspaceId: workspace.id } },
    });

    expect(listRes.response.status).toBe(200);
    expect(listRes.data!.items.some((p) => p.id === policyId)).toBe(true);
    expect(typeof listRes.data!.total).toBe("number");
    expect(listRes.data!.total).toBeGreaterThanOrEqual(1);

    await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
    });
  });

  test("should list policies with pagination", async ({ api, workspace }) => {
    const policyIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const createRes = await api.POST(
        "/v1/workspaces/{workspaceId}/policies",
        {
          params: { path: { workspaceId: workspace.id } },
          body: {
            name: `policy-page-${i}-${faker.string.alphanumeric(8)}`,
            rules: [],
            metadata: {},
          },
        },
      );
      expect(createRes.response.status).toBe(202);
      policyIds.push(createRes.data!.id);
    }

    const page1 = await api.GET("/v1/workspaces/{workspaceId}/policies", {
      params: {
        path: { workspaceId: workspace.id },
        query: { limit: 2, offset: 0 },
      },
    });

    expect(page1.response.status).toBe(200);
    expect(page1.data!.items.length).toBeLessThanOrEqual(2);
    expect(page1.data!.limit).toBe(2);
    expect(page1.data!.offset).toBe(0);

    const page2 = await api.GET("/v1/workspaces/{workspaceId}/policies", {
      params: {
        path: { workspaceId: workspace.id },
        query: { limit: 2, offset: 2 },
      },
    });

    expect(page2.response.status).toBe(200);
    expect(page2.data!.limit).toBe(2);
    expect(page2.data!.offset).toBe(2);

    for (const policyId of policyIds) {
      await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
        params: { path: { workspaceId: workspace.id, policyId } },
      });
    }
  });

  test("should create a policy with anyApproval rule", async ({
    api,
    workspace,
  }) => {
    const name = `policy-approval-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST("/v1/workspaces/{workspaceId}/policies", {
      params: { path: { workspaceId: workspace.id } },
      body: {
        name,
        rules: [{ anyApproval: { minApprovals: 2 } }],
        metadata: {},
      },
    });

    expect(createRes.response.status).toBe(202);
    const policyId = createRes.data!.id;
    const rules = createRes.data!.rules;
    expect(rules).toHaveLength(1);
    expect(rules[0]!.anyApproval).toEqual({ minApprovals: 2 });

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.rules).toHaveLength(1);
    expect(getRes.data!.rules[0]!.anyApproval).toEqual({ minApprovals: 2 });

    await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
    });
  });

  test("should create a policy with deploymentWindow rule", async ({
    api,
    workspace,
  }) => {
    const name = `policy-window-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST("/v1/workspaces/{workspaceId}/policies", {
      params: { path: { workspaceId: workspace.id } },
      body: {
        name,
        rules: [
          {
            deploymentWindow: {
              allowWindow: true,
              durationMinutes: 60,
              rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
              timezone: "America/New_York",
            },
          },
        ],
      },
    });

    expect(createRes.response.status).toBe(202);
    const policyId = createRes.data!.id;
    const rules = createRes.data!.rules;
    expect(rules).toHaveLength(1);
    expect(rules[0]!.deploymentWindow).toMatchObject({
      allowWindow: true,
      durationMinutes: 60,
      rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
      timezone: "America/New_York",
    });

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.rules[0]!.deploymentWindow).toMatchObject({
      allowWindow: true,
      durationMinutes: 60,
      rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
      timezone: "America/New_York",
    });

    await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
    });
  });

  test("should create a policy with retry rule", async ({ api, workspace }) => {
    const name = `policy-retry-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST("/v1/workspaces/{workspaceId}/policies", {
      params: { path: { workspaceId: workspace.id } },
      body: {
        name,
        rules: [
          {
            retry: {
              maxRetries: 3,
              backoffSeconds: 30,
              backoffStrategy: "exponential",
              maxBackoffSeconds: 300,
            },
          },
        ],
      },
    });

    expect(createRes.response.status).toBe(202);
    const policyId = createRes.data!.id;
    const rules = createRes.data!.rules;
    expect(rules).toHaveLength(1);
    expect(rules[0]!.retry).toMatchObject({
      maxRetries: 3,
      backoffSeconds: 30,
      backoffStrategy: "exponential",
      maxBackoffSeconds: 300,
    });

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.rules[0]!.retry).toMatchObject({
      maxRetries: 3,
      backoffSeconds: 30,
      backoffStrategy: "exponential",
      maxBackoffSeconds: 300,
    });

    await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
    });
  });

  test("should create a policy with versionSelector rule", async ({
    api,
    workspace,
  }) => {
    const name = `policy-vs-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST("/v1/workspaces/{workspaceId}/policies", {
      params: { path: { workspaceId: workspace.id } },
      body: {
        name,
        rules: [
          {
            versionSelector: {
              selector: 'version.tag.startsWith("v1.")',
              description: "Only allow v1.x releases",
            },
          },
        ],
      },
    });

    expect(createRes.response.status).toBe(202);
    const policyId = createRes.data!.id;
    const rules = createRes.data!.rules;
    expect(rules).toHaveLength(1);
    expect(rules[0]!.versionSelector).toMatchObject({
      selector: 'version.tag.startsWith("v1.")',
      description: "Only allow v1.x releases",
    });

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.rules[0]!.versionSelector).toMatchObject({
      selector: 'version.tag.startsWith("v1.")',
      description: "Only allow v1.x releases",
    });

    await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
    });
  });

  test("should create a policy with gradualRollout rule", async ({
    api,
    workspace,
  }) => {
    const name = `policy-rollout-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST("/v1/workspaces/{workspaceId}/policies", {
      params: { path: { workspaceId: workspace.id } },
      body: {
        name,
        rules: [
          {
            gradualRollout: {
              rolloutType: "linear",
              timeScaleInterval: 10,
            },
          },
        ],
      },
    });

    expect(createRes.response.status).toBe(202);
    const policyId = createRes.data!.id;
    const rules = createRes.data!.rules;
    expect(rules).toHaveLength(1);
    expect(rules[0]!.gradualRollout).toMatchObject({
      rolloutType: "linear",
      timeScaleInterval: 10,
    });

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.rules[0]!.gradualRollout).toMatchObject({
      rolloutType: "linear",
      timeScaleInterval: 10,
    });

    await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
    });
  });

  test("should create a policy with versionCooldown rule", async ({
    api,
    workspace,
  }) => {
    const name = `policy-cooldown-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST("/v1/workspaces/{workspaceId}/policies", {
      params: { path: { workspaceId: workspace.id } },
      body: {
        name,
        rules: [{ versionCooldown: { intervalSeconds: 3600 } }],
      },
    });

    expect(createRes.response.status).toBe(202);
    const policyId = createRes.data!.id;
    const rules = createRes.data!.rules;
    expect(rules).toHaveLength(1);
    expect(rules[0]!.versionCooldown).toEqual({ intervalSeconds: 3600 });

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.rules[0]!.versionCooldown).toEqual({
      intervalSeconds: 3600,
    });

    await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
    });
  });

  test("should create a policy with deploymentDependency rule", async ({
    api,
    workspace,
  }) => {
    const name = `policy-depdep-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST("/v1/workspaces/{workspaceId}/policies", {
      params: { path: { workspaceId: workspace.id } },
      body: {
        name,
        rules: [
          {
            deploymentDependency: {
              dependsOn: "deployment.name == 'db-migration'",
            },
          },
        ],
      },
    });

    expect(createRes.response.status).toBe(202);
    const policyId = createRes.data!.id;
    const rules = createRes.data!.rules;
    expect(rules).toHaveLength(1);
    expect(rules[0]!.deploymentDependency).toMatchObject({
      dependsOn: "deployment.name == 'db-migration'",
    });

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.rules[0]!.deploymentDependency).toMatchObject({
      dependsOn: "deployment.name == 'db-migration'",
    });

    await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
    });
  });

  test("should create a policy with verification rule", async ({
    api,
    workspace,
  }) => {
    const name = `policy-verify-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST("/v1/workspaces/{workspaceId}/policies", {
      params: { path: { workspaceId: workspace.id } },
      body: {
        name,
        rules: [
          {
            verification: {
              triggerOn: "jobSuccess",
              metrics: [
                {
                  name: "health-check",
                  intervalSeconds: 30,
                  count: 3,
                  failureThreshold: 0,
                  successCondition: "result.statusCode == 200",
                  provider: {
                    type: "http",
                    url: "http://localhost/health",
                    method: "GET",
                    timeout: "10s",
                  },
                },
              ],
            },
          },
        ],
      },
    });

    expect(createRes.response.status).toBe(202);
    const policyId = createRes.data!.id;
    const rules = createRes.data!.rules;
    expect(rules).toHaveLength(1);
    expect(rules[0]!.verification).toMatchObject({
      triggerOn: "jobSuccess",
      metrics: [
        {
          name: "health-check",
          intervalSeconds: 30,
          count: 3,
          successCondition: "result.statusCode == 200",
          provider: {
            type: "http",
            url: "http://localhost/health",
            method: "GET",
          },
        },
      ],
    });

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.rules[0]!.verification).toMatchObject({
      triggerOn: "jobSuccess",
      metrics: [
        {
          name: "health-check",
          intervalSeconds: 30,
          count: 3,
          successCondition: "result.statusCode == 200",
        },
      ],
    });

    await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
    });
  });

  test("should upsert a policy with description and metadata", async ({
    api,
    workspace,
  }) => {
    const policyId = uuidv4();
    const name = `policy-desc-meta-${faker.string.alphanumeric(8)}`;

    const createRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
        body: {
          name,
          description: "Initial description",
          priority: 1,
          enabled: true,
          selector: "true",
          rules: [],
          metadata: { team: "platform" },
        },
      },
    );

    expect(createRes.response.status).toBe(202);
    expect(createRes.data!.description).toBe("Initial description");
    expect(createRes.data!.metadata).toEqual({ team: "platform" });

    const updateRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
        body: {
          name,
          description: "Updated description",
          priority: 1,
          enabled: true,
          selector: "true",
          rules: [],
          metadata: { team: "infra", env: "production" },
        },
      },
    );

    expect(updateRes.response.status).toBe(202);

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.description).toBe("Updated description");
    expect(getRes.data!.metadata).toEqual({ team: "infra", env: "production" });

    await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
    });
  });

  test("should create a policy with environmentProgression rule", async ({
    api,
    workspace,
  }) => {
    const name = `policy-envprog-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST("/v1/workspaces/{workspaceId}/policies", {
      params: { path: { workspaceId: workspace.id } },
      body: {
        name,
        rules: [
          {
            environmentProgression: {
              dependsOnEnvironmentSelector: 'environment.name == "staging"',
              minimumSoakTimeMinutes: 30,
              minimumSuccessPercentage: 95,
              maximumAgeHours: 24,
            },
          },
        ],
      },
    });

    expect(createRes.response.status).toBe(202);
    const policyId = createRes.data!.id;
    const rules = createRes.data!.rules;
    expect(rules).toHaveLength(1);
    expect(rules[0]!.environmentProgression).toMatchObject({
      dependsOnEnvironmentSelector: 'environment.name == "staging"',
      minimumSoakTimeMinutes: 30,
      minimumSuccessPercentage: 95,
      maximumAgeHours: 24,
    });

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.rules[0]!.environmentProgression).toMatchObject({
      dependsOnEnvironmentSelector: 'environment.name == "staging"',
      minimumSoakTimeMinutes: 30,
      minimumSuccessPercentage: 95,
      maximumAgeHours: 24,
    });

    await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
    });
  });

  test("should create a policy with multiple rules", async ({
    api,
    workspace,
  }) => {
    const name = `policy-multi-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST("/v1/workspaces/{workspaceId}/policies", {
      params: { path: { workspaceId: workspace.id } },
      body: {
        name,
        rules: [
          { anyApproval: { minApprovals: 1 } },
          { retry: { maxRetries: 2, backoffStrategy: "linear" } },
          { versionCooldown: { intervalSeconds: 1800 } },
        ],
        metadata: {},
      },
    });

    expect(createRes.response.status).toBe(202);
    const policyId = createRes.data!.id;
    expect(createRes.data!.rules).toHaveLength(3);

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    const rules = getRes.data!.rules;
    expect(rules).toHaveLength(3);
    expect(rules.some((r) => r.anyApproval != null)).toBe(true);
    expect(rules.some((r) => r.retry != null)).toBe(true);
    expect(rules.some((r) => r.versionCooldown != null)).toBe(true);

    await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
    });
  });

  test("should replace rules on upsert", async ({ api, workspace }) => {
    const policyId = uuidv4();
    const name = `policy-rules-replace-${faker.string.alphanumeric(8)}`;

    await api.PUT("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
      body: {
        name,
        priority: 0,
        enabled: true,
        selector: "true",
        rules: [
          { anyApproval: { minApprovals: 1 } },
          { retry: { maxRetries: 3, backoffStrategy: "linear" } },
        ],
        metadata: {},
      },
    });

    const upsertRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
        body: {
          name,
          priority: 0,
          enabled: true,
          selector: "true",
          rules: [{ versionCooldown: { intervalSeconds: 600 } }],
          metadata: {},
        },
      },
    );

    expect(upsertRes.response.status).toBe(202);

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    const rules = getRes.data!.rules;
    expect(rules).toHaveLength(1);
    expect(rules[0]!.versionCooldown).toEqual({ intervalSeconds: 600 });
    expect(rules.some((r) => r.anyApproval != null)).toBe(false);
    expect(rules.some((r) => r.retry != null)).toBe(false);

    await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
    });
  });

  test("should create a disabled policy", async ({ api, workspace }) => {
    const name = `policy-disabled-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST("/v1/workspaces/{workspaceId}/policies", {
      params: { path: { workspaceId: workspace.id } },
      body: { name, enabled: false, rules: [] },
    });

    expect(createRes.response.status).toBe(202);
    const policyId = createRes.data!.id;
    expect(createRes.data!.enabled).toBe(false);

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.enabled).toBe(false);

    await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
    });
  });

  test("should preserve createdAt timestamp across upserts", async ({
    api,
    workspace,
  }) => {
    const policyId = uuidv4();
    const name = `policy-timestamps-${faker.string.alphanumeric(8)}`;

    const createRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
        body: {
          name,
          priority: 0,
          enabled: true,
          selector: "true",
          rules: [],
          metadata: {},
        },
      },
    );

    expect(createRes.response.status).toBe(202);
    const originalCreatedAt = createRes.data!.createdAt;

    const updateRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/policies/{policyId}",
      {
        params: { path: { workspaceId: workspace.id, policyId } },
        body: {
          name: `${name}-updated`,
          priority: 5,
          enabled: false,
          selector: "false",
          rules: [],
          metadata: {},
        },
      },
    );

    expect(updateRes.response.status).toBe(202);
    expect(updateRes.data!.createdAt).toBe(originalCreatedAt);

    await api.DELETE("/v1/workspaces/{workspaceId}/policies/{policyId}", {
      params: { path: { workspaceId: workspace.id, policyId } },
    });
  });
});
