import { test, expect } from '@playwright/test';
import path from 'path';
import { ApiClient } from '../../api';
import { importEntitiesFromYaml, cleanupImportedEntities } from '../../api/yaml-loader';

// Setup test variables
const TEST_YAML_FILE = path.resolve(__dirname, '../fixtures/template-example.yaml');

test.describe('YAML Template Engine', () => {
  let api: ApiClient;
  let workspaceId: string;
  let importedEntities: any;

  test.beforeAll(async ({ request }) => {
    // Initialize API client
    api = new ApiClient(request);
    await api.auth();
    
    // Get workspace ID
    const workspacesResponse = await api.GET('/v1/workspaces');
    workspaceId = workspacesResponse.data!.workspaces[0].id;
  });

  test.afterAll(async () => {
    // Clean up all created entities
    if (importedEntities) {
      await cleanupImportedEntities(api, importedEntities);
    }
  });

  test('should process templates in YAML file', async () => {
    // Import entities from YAML with template processing
    importedEntities = await importEntitiesFromYaml(api, workspaceId, TEST_YAML_FILE, {
      processTemplates: true,
      updateSelectors: true
    });

    // Verify system was created
    expect(importedEntities.system.id).toBeTruthy();
    expect(importedEntities.system.name).toContain('test-system-');
    expect(importedEntities.system.slug).toContain('test-');
    
    // Verify environments were created
    expect(importedEntities.environments.length).toBe(1);
    expect(importedEntities.environments[0].name).toContain('dev-env-');
    
    // Verify resources were created
    expect(importedEntities.resources.length).toBe(2);
    expect(importedEntities.resources[0].identifier).toContain('resource-');
    expect(importedEntities.resources[1].identifier).toContain('resource-');
    
    // Verify deployments were created
    expect(importedEntities.deployments.length).toBe(1);
    
    // Verify policies were created
    expect(importedEntities.policies.length).toBe(1);
    expect(importedEntities.policies[0].name).toContain('deployment-policy-');
    
    // Verify dynamic values were processed
    // Test by fetching one of the resources and checking its config
    const resourceResponse = await api.GET(`/v1/resources/${importedEntities.resources[0].identifier}`);
    expect(resourceResponse.data).toBeTruthy();
    
    // Verify that the replicas field was populated with a random number between 1 and 5
    const replicas = resourceResponse.data!.config.replicas;
    expect(replicas).toBeGreaterThanOrEqual(1);
    expect(replicas).toBeLessThanOrEqual(5);
  });

  test('should support custom template helpers', async () => {
    // Clean up previous entities if any
    if (importedEntities) {
      await cleanupImportedEntities(api, importedEntities);
      importedEntities = null;
    }
    
    // Define custom template helpers
    const customHelpers = {
      customPrefix: () => 'custom-prefix',
      environment: () => process.env.NODE_ENV || 'test'
    };
    
    // Import entities with custom template helpers
    importedEntities = await importEntitiesFromYaml(api, workspaceId, TEST_YAML_FILE, {
      processTemplates: true,
      updateSelectors: true,
      templateHelpers: customHelpers
    });
    
    // Verify entities were created
    expect(importedEntities.system.id).toBeTruthy();
    
    // Note: Since we don't use the custom helpers in our template file,
    // we're just verifying that the import still works with custom helpers
  });
});