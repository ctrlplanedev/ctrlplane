/**
 * Workspace Policy API Tests
 * 
 * Tests for DELETE /v1/workspaces/{workspaceId}/policies/{name} endpoint
 */

import { expect } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { test } from '../../fixtures';
import { RRule } from 'rrule';
import { createPolicy, type Policy, type CreatePolicy } from "@ctrlplane/db/schema";

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
  description: `Test policy for deletion - ${name}`,
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
        freq: RRule.DAILY,
        interval: 1,
        dtstart: new Date(),
        wkst: RRule.MO
      } as any
    }
  ],
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

test.describe('Workspace Policy API - Delete', () => {
  // Success Cases
  test('should delete an existing policy by name', async ({ request, workspace, apiToken }) => {
    // Create a policy first
    const policyName = `test-delete-policy-${faker.string.alphanumeric(8)}`;
    const policy = createPolicyTemplate(policyName, workspace.name);
    
    const createResponse = await request.post('/api/v1/policies', {
      data: policy,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-token': apiToken.token
      }
    });
    
    expect(createResponse.ok()).toBeTruthy();
    
    // Delete the policy
    const deleteResponse = await request.delete(`/api/v1/workspaces/${workspace.name}/policies/${policyName}`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-token': apiToken.token
      }
    });
    
    // Assertions for successful deletion
    expect(deleteResponse.ok()).toBeTruthy();
    expect(deleteResponse.status()).toBe(200);
    
    // Verify policy is actually deleted by trying to delete it again
    const secondDeleteResponse = await request.delete(`/api/v1/workspaces/${workspace.name}/policies/${policyName}`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-token': apiToken.token
      }
    });
    
    // It should not be found
    expect(secondDeleteResponse.ok()).toBeFalsy();
    expect(secondDeleteResponse.status()).toBe(404);
  });

  // Failure Cases
  test('should fail to delete a non-existent policy name', async ({ request, workspace, apiToken }) => {
    const nonExistentName = `non-existent-policy-${faker.string.alphanumeric(8)}`;
    
    const response = await request.delete(`/api/v1/workspaces/${workspace.name}/policies/${nonExistentName}`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-token': apiToken.token
      }
    });
    
    // Assertions
    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBe(404);
  });

  test('should fail to delete with an invalid workspaceId format', async ({ request, apiToken }) => {
    // Using an invalid workspace ID format
    const invalidWorkspaceId = 'not-a-valid-id';
    const policyName = `test-policy-${faker.string.alphanumeric(8)}`;
    
    const response = await request.delete(`/api/v1/workspaces/${invalidWorkspaceId}/policies/${policyName}`, {
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

  test('should fail to delete with a non-existent workspaceId', async ({ request, apiToken }) => {
    // Using a correctly formatted but non-existent ID
    const nonExistentWorkspaceId = `non-existent-workspace-${faker.string.alphanumeric(8)}`;
    const policyName = `test-policy-${faker.string.alphanumeric(8)}`;
    
    const response = await request.delete(`/api/v1/workspaces/${nonExistentWorkspaceId}/policies/${policyName}`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-token': apiToken.token
      }
    });
    
    // Assertions
    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBe(404);
  });

  test('should fail without authentication token', async ({ request, workspace }) => {
    const policyName = `test-policy-${faker.string.alphanumeric(8)}`;
    
    // Override the authorization header for this request
    const response = await request.delete(`/api/v1/workspaces/${workspace.name}/policies/${policyName}`, {
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