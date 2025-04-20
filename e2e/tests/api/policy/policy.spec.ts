/**
 * Policy Upsert API Tests
 * 
 * Tests for POST /v1/policies endpoint
 */

import { expect } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { test } from '../../fixtures';
import { RRule } from 'rrule';
import { 
  createPolicy,
} from "@ctrlplane/db/schema";
import type { 
  Policy,
  PolicyTarget as PolicyTargetInsert,
  CreatePolicy,
} from "@ctrlplane/db/schema";

// RRule frequency constants
const FREQ = {
  YEARLY: 0,
  MONTHLY: 1,
  WEEKLY: 2,
  DAILY: 3,
  HOURLY: 4,
  MINUTELY: 5,
  SECONDLY: 6
};

// Basic policy template for reuse
const createPolicyTemplate = (name: string, workspaceId: string): CreatePolicy => ({
  name,
  workspaceId,
  description: `Test policy description for ${name}`,
  priority: 1,
  enabled: true,
  targets: [
    {
      deploymentSelector: {
        name: 'test-deployment'
      }
    }
  ],
  denyWindows: [
    {
      timeZone: 'UTC',
      rrule: {
        freq: RRule.WEEKLY,
        byweekday: [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR],
        byhour: [17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7, 8],
        dtstart: new Date(),
        interval: 1,
        wkst: RRule.MO,
      } as any
    }
  ],
  deploymentVersionSelector: {
    name: 'latest-version',
    deploymentVersionSelector: {
      semver: '>= 1.0.0'
    },
    description: 'Selects the latest version'
  },
  versionAnyApprovals: {
    requiredApprovalsCount: 1
  },
  versionUserApprovals: [
    {
      userId: 'test-user-id'
    }
  ],
  versionRoleApprovals: [
    {
      roleId: 'test-role-id',
      requiredApprovalsCount: 1
    }
  ]
});

test.describe('Policy API - Upsert', () => {
  // Success Cases
  test('should create a new policy with minimal required fields', async ({ request, workspace, apiToken }) => {
    console.log(`Using workspace: ${workspace.name}`);
    console.log(`Using API token: ${apiToken.prefix}...`);
    
    const policyName = `test-policy-${faker.string.alphanumeric(8)}`;
    const minimalPolicy: CreatePolicy = {
      name: policyName,
      workspaceId: workspace.name,
      targets: [{ deploymentSelector: { name: 'test' } }],
      denyWindows: [{ 
        timeZone: 'UTC', 
        rrule: {
          freq: RRule.DAILY,
          dtstart: new Date(),
          interval: 1,
          wkst: RRule.MO
        } as any
      }],
      versionUserApprovals: [{ userId: 'test-user-id' }],
      versionRoleApprovals: [{ roleId: 'test-role-id', requiredApprovalsCount: 1 }]
    };

    console.log('Request payload:', JSON.stringify(minimalPolicy, null, 2));
    
    const response = await request.post('/api/v1/policies', {
      data: minimalPolicy,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-token': apiToken.token
      }
    });

    console.log(`Response status: ${response.status()}`);
    console.log(`Response status text: ${response.statusText()}`);
    
    const responseBody = await response.text();
    console.log(`Response body: ${responseBody}`);

    // Assertions
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const body = await JSON.parse(responseBody) as Policy;
    expect(body).toHaveProperty('id');
    expect(body.name).toBe(policyName);
    expect(body.workspaceId).toBe(workspace.name);

    // Cleanup - delete the created policy if possible
    try {
      await request.delete(`/api/v1/workspaces/${workspace.name}/policies/${policyName}`, {
        headers: {
          'x-api-token': apiToken.token
        }
      });
    } catch (error) {
      console.log(`Cleanup failed for policy ${policyName}:`, error);
    }
  });

  test('should create a new policy with all optional fields', async ({ request, workspace, apiToken }) => {
    const policyName = `test-policy-${faker.string.alphanumeric(8)}`;
    const fullPolicy = createPolicyTemplate(policyName, workspace.name);

    const response = await request.post('/api/v1/policies', {
      data: fullPolicy,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-token': apiToken.token
      }
    });

    // Assertions
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const body = await response.json() as Policy;
    expect(body).toHaveProperty('id');
    expect(body.name).toBe(policyName);
    expect(body.description).toBe(fullPolicy.description);
    expect(body.priority).toBe(fullPolicy.priority);
    expect(body.enabled).toBe(fullPolicy.enabled);
    expect(body.workspaceId).toBe(workspace.name);

    // Cleanup 
    try {
      await request.delete(`/api/v1/workspaces/${workspace.name}/policies/${policyName}`, {
        headers: {
          'x-api-token': apiToken.token
        }
      });
    } catch (error) {
      console.log(`Cleanup failed for policy ${policyName}:`, error);
    }
  });

  test('should update an existing policy description', async ({ request, workspace, apiToken }) => {
    // First create a policy
    const policyName = `test-policy-${faker.string.alphanumeric(8)}`;
    const initialPolicy = createPolicyTemplate(policyName, workspace.name);
    
    const createResponse = await request.post('/api/v1/policies', {
      data: initialPolicy,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-token': apiToken.token
      }
    });
    
    expect(createResponse.ok()).toBeTruthy();
    
    // Now update the policy
    const updatedDescription = `Updated description ${faker.string.sample(20)}`;
    const updatePolicy: CreatePolicy = {
      ...initialPolicy,
      description: updatedDescription
    };
    
    const updateResponse = await request.post('/api/v1/policies', {
      data: updatePolicy,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-token': apiToken.token
      }
    });
    
    // Assertions
    expect(updateResponse.ok()).toBeTruthy();
    expect(updateResponse.status()).toBe(200);
    
    const body = await updateResponse.json() as Policy;
    expect(body.description).toBe(updatedDescription);
    
    // Cleanup
    try {
      await request.delete(`/api/v1/workspaces/${workspace.name}/policies/${policyName}`, {
        headers: {
          'x-api-token': apiToken.token
        }
      });
    } catch (error) {
      console.log(`Cleanup failed for policy ${policyName}:`, error);
    }
  });

  test('should update an existing policy enabled status', async ({ request, workspace, apiToken }) => {
    // First create a policy
    const policyName = `test-policy-${faker.string.alphanumeric(8)}`;
    const initialPolicy = createPolicyTemplate(policyName, workspace.name);
    
    const createResponse = await request.post('/api/v1/policies', {
      data: initialPolicy,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-token': apiToken.token
      }
    });
    
    expect(createResponse.ok()).toBeTruthy();
    
    // Now update the policy's enabled status
    const updatePolicy: CreatePolicy = {
      ...initialPolicy,
      enabled: false
    };
    
    const updateResponse = await request.post('/api/v1/policies', {
      data: updatePolicy,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-token': apiToken.token
      }
    });
    
    // Assertions
    expect(updateResponse.ok()).toBeTruthy();
    expect(updateResponse.status()).toBe(200);
    
    const body = await updateResponse.json() as Policy;
    expect(body.enabled).toBe(false);
    
    // Cleanup
    try {
      await request.delete(`/api/v1/workspaces/${workspace.name}/policies/${policyName}`, {
        headers: {
          'x-api-token': apiToken.token
        }
      });
    } catch (error) {
      console.log(`Cleanup failed for policy ${policyName}:`, error);
    }
  });

  // Failure Cases
  test('should fail to create policy without required field: name', async ({ request, workspace, apiToken }) => {
    // Using type casting to create an invalid policy intentionally for testing
    const invalidPolicy = {
      // name is missing
      workspaceId: workspace.name,
      targets: [{ deploymentSelector: { name: 'test' } }],
      denyWindows: [{ timeZone: 'UTC', rrule: { freq: FREQ.DAILY } }],
      versionUserApprovals: [{ userId: 'test-user-id' }],
      versionRoleApprovals: [{ roleId: 'test-role-id', requiredApprovalsCount: 1 }]
    } as unknown as CreatePolicy;

    const response = await request.post('/api/v1/policies', {
      data: invalidPolicy,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-token': apiToken.token
      }
    });

    // Assertions
    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });

  test('should fail to create policy without required field: workspaceId', async ({ request, apiToken }) => {
    const policyName = `test-policy-${faker.string.alphanumeric(8)}`;
    // Using type casting to create an invalid policy intentionally for testing
    const invalidPolicy = {
      name: policyName,
      // workspaceId is missing
      targets: [{ deploymentSelector: { name: 'test' } }],
      denyWindows: [{ timeZone: 'UTC', rrule: { freq: FREQ.DAILY } }],
      versionUserApprovals: [{ userId: 'test-user-id' }],
      versionRoleApprovals: [{ roleId: 'test-role-id', requiredApprovalsCount: 1 }]
    } as unknown as CreatePolicy;

    const response = await request.post('/api/v1/policies', {
      data: invalidPolicy,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-token': apiToken.token
      }
    });

    // Assertions
    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });

  test('should fail to create policy without required field: targets', async ({ request, workspace, apiToken }) => {
    const policyName = `test-policy-${faker.string.alphanumeric(8)}`;
    // Using type casting to create an invalid policy intentionally for testing
    const invalidPolicy = {
      name: policyName,
      workspaceId: workspace.name,
      // targets is missing
      denyWindows: [{ timeZone: 'UTC', rrule: { freq: FREQ.DAILY } }],
      versionUserApprovals: [{ userId: 'test-user-id' }],
      versionRoleApprovals: [{ roleId: 'test-role-id', requiredApprovalsCount: 1 }]
    } as unknown as CreatePolicy;

    const response = await request.post('/api/v1/policies', {
      data: invalidPolicy,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-token': apiToken.token
      }
    });

    // Assertions
    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });

  test('should fail to create policy with invalid data type for priority', async ({ request, workspace, apiToken }) => {
    const policyName = `test-policy-${faker.string.alphanumeric(8)}`;
    const invalidPolicy = {
      name: policyName,
      workspaceId: workspace.name,
      priority: "high", // Invalid type - should be number
      targets: [{ deploymentSelector: { name: 'test' } }],
      denyWindows: [{ timeZone: 'UTC', rrule: { freq: FREQ.DAILY } }],
      versionUserApprovals: [{ userId: 'test-user-id' }],
      versionRoleApprovals: [{ roleId: 'test-role-id', requiredApprovalsCount: 1 }]
    };

    const response = await request.post('/api/v1/policies', {
      data: invalidPolicy,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-token': apiToken.token
      }
    });

    // Assertions
    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });

  test('should fail to create policy with non-existent workspaceId', async ({ request, apiToken }) => {
    const policyName = `test-policy-${faker.string.alphanumeric(8)}`;
    const nonExistentPolicy: CreatePolicy = {
      name: policyName,
      workspaceId: 'non-existent-workspace-id',
      targets: [{ deploymentSelector: { name: 'test' } }],
      denyWindows: [{ timeZone: 'UTC', rrule: {
        freq: RRule.DAILY,
        dtstart: new Date(),
        interval: 1,
        wkst: RRule.MO
      } as any }],
      versionUserApprovals: [{ userId: 'test-user-id' }],
      versionRoleApprovals: [{ roleId: 'test-role-id', requiredApprovalsCount: 1 }]
    };

    const response = await request.post('/api/v1/policies', {
      data: nonExistentPolicy,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-token': apiToken.token
      }
    });

    // Assertions
    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });

  test('should fail without authentication token', async ({ request, workspace }) => {
    // Create a request context without auth token
    const policyName = `test-policy-${faker.string.alphanumeric(8)}`;
    const policy = createPolicyTemplate(policyName, workspace.name);
    
    // Override the authorization header for this request
    const response = await request.post('/api/v1/policies', {
      data: policy,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Authorization header omitted
      }
    });

    // Assertions
    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBe(401);
  });
}); 