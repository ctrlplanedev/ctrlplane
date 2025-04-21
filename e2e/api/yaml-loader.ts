import fs from "fs";
import path from "path";
import { faker } from "@faker-js/faker";
import yaml from "js-yaml";

import { ApiClient } from "./index";

// Define types for YAML structure
export interface TestYamlFile {
  system: {
    name: string;
    slug: string;
    description?: string;
  };
  environments?: Array<{
    name: string;
    description?: string;
    metadata?: Record<string, string>;
    resourceSelector?: any;
  }>;
  resources?: Array<{
    name: string;
    kind: string;
    identifier: string;
    version: string;
    config: Record<string, any>;
    metadata: Record<string, string>;
  }>;
  deployments?: Array<{
    name: string;
    slug: string;
    description?: string;
    resourceSelector?: any;
  }>;
  policies?: Array<{
    name: string;
    targets: Array<{
      environmentSelector?: any;
      deploymentSelector?: any;
      resourceSelector?: any;
    }>;
    versionAnyApprovals?: Array<{
      requiredApprovalsCount: number;
    }>;
    denyWindows?: Array<{
      timeZone: string;
      rrule: any;
    }>;
  }>;
}

// Define return type for imported entities
export interface ImportedEntities {
  // The prefix that was used for entity names (if any)
  prefix: string;

  system: {
    id: string;
    name: string;
    slug: string;
    originalName?: string; // Original name without prefix
  };
  environments: Array<{
    id: string;
    name: string;
    originalName?: string;
  }>;
  resources: Array<{
    identifier: string;
    name: string;
    kind: string;
    originalIdentifier?: string;
  }>;
  deployments: Array<{
    id: string;
    name: string;
    slug: string;
    originalName?: string;
  }>;
  policies: Array<{
    id: string;
    name: string;
    originalName?: string;
  }>;
}

/**
 * Apply a prefix to a string value
 */
function applyPrefix(value: string, prefix: string): string {
  return `${prefix}-${value}`;
}

/**
 * Import entities from a YAML file into the workspace
 * @param api API client instance
 * @param workspaceId ID of the workspace to import into
 * @param yamlFilePath Path to the YAML file (absolute or relative to the execution directory)
 * @param options Import options for prefix handling
 * @returns Object containing all created entities with their IDs
 */
export async function importEntitiesFromYaml(
  api: ApiClient,
  workspaceId: string,
  yamlFilePath: string,
): Promise<ImportedEntities> {
  // Load and parse YAML file
  const resolvedPath = path.isAbsolute(yamlFilePath)
    ? yamlFilePath
    : path.resolve(process.cwd(), yamlFilePath);

  const fileContent = fs.readFileSync(resolvedPath, "utf8");
  const data = yaml.load(fileContent) as TestYamlFile;

  // Determine prefix if needed
  const prefix = `test-${faker.string.alphanumeric(8)}`;

  // Initialize result object
  const result: ImportedEntities = {
    prefix,
    system: { id: "", name: "", slug: "" },
    environments: [],
    resources: [],
    deployments: [],
    policies: [],
  };

  // Apply prefix to system data if needed
  const systemName = prefix
    ? applyPrefix(data.system.name, prefix)
    : data.system.name;
  const systemSlug = prefix
    ? applyPrefix(data.system.slug, prefix)
    : data.system.slug;

  // Create system
  console.log(`Creating system: ${systemName}`);
  const systemResponse = await api.POST("/v1/systems", {
    body: {
      workspaceId,
      name: systemName,
      slug: systemSlug,
      description: data.system.description,
    },
  });

  if (systemResponse.response.status !== 201) {
    throw new Error(
      `Failed to create system: ${JSON.stringify(systemResponse.error)}`,
    );
  }

  result.system = {
    id: systemResponse.data!.id,
    name: systemResponse.data!.name,
    slug: systemResponse.data!.slug,
    originalName: data.system.name,
  };

  // Create resources with prefix if needed
  if (data.resources != null && data.resources.length > 0) {
    console.log(`Creating ${data.resources.length} resources`);

    // Apply prefix to resources if needed
    const prefixedResources = data.resources.map((resource) => ({
      ...resource,
      name: applyPrefix(resource.name, prefix),
      identifier: applyPrefix(resource.identifier, prefix),
    }));

    console.log(`Prefixed resources: ${JSON.stringify(prefixedResources)}`);

    const resourcesResponse = await api.POST("/v1/resources", {
      body: {
        workspaceId,
        resources: prefixedResources.map((resource) => ({
          name: resource.name,
          kind: resource.kind,
          identifier: resource.identifier,
          version: resource.version,
          config: (resource.config ?? {}) as any,
          metadata: resource.metadata ?? {},
        })),
      },
    });

    if (resourcesResponse.response.status !== 200) {
      throw new Error(
        `Failed to create resources: ${JSON.stringify(resourcesResponse.error)}`,
      );
    }

    // Store created resources in result
    for (let i = 0; i < prefixedResources.length; i++) {
      const resource = prefixedResources[i];
      const originalResource = data.resources[i];

      result.resources.push({
        identifier: resource.identifier,
        name: resource.name,
        kind: resource.kind,
        originalIdentifier: originalResource.identifier,
      });
    }
  }

  // Create environments with prefixes if needed
  if (data.environments != null && data.environments.length > 0) {
    for (const env of data.environments) {
      const envResponse = await api.POST("/v1/environments", {
        body: {
          ...env,
          systemId: result.system.id,
        },
      });

      if (envResponse.response.status !== 200) {
        throw new Error(
          `Failed to create environment: ${JSON.stringify(envResponse.error)}`,
        );
      }

      result.environments.push({
        id: envResponse.data!.id,
        name: envResponse.data!.name,
        originalName: env.name,
      });
    }
  }

  // Create deployments with prefixes if needed
  if (data.deployments && data.deployments.length > 0) {
    for (const deployment of data.deployments) {
      const deploymentResponse = await api.POST("/v1/deployments", {
        body: {
          ...deployment,
          systemId: result.system.id,
        },
      });

      if (deploymentResponse.response.status !== 201) {
        throw new Error(
          `Failed to create deployment: ${JSON.stringify(deploymentResponse.error)}`,
        );
      }

      result.deployments.push({
        id: deploymentResponse.data!.id,
        name: deploymentResponse.data!.name,
        slug: deploymentResponse.data!.slug,
        originalName: deployment.name,
      });
    }
  }

  // Create policies with prefixes if needed
  if (data.policies && data.policies.length > 0) {
    for (const policy of data.policies) {
      const policyName = prefix
        ? applyPrefix(policy.name, prefix)
        : policy.name;
      console.log(`Creating policy: ${policyName}`);

      const policyResponse = await api.POST("/v1/policies", {
        body: { ...policy, workspaceId },
      });

      if (policyResponse.response.status !== 200) {
        throw new Error(
          `Failed to create policy: ${JSON.stringify(policyResponse.error)}`,
        );
      }

      result.policies.push({
        id: policyResponse.data!.id,
        name: policyResponse.data!.name,
        originalName: policy.name,
      });
    }
  }

  return result;
}

/**
 * Delete all entities created from a YAML import
 * @param api API client instance
 * @param entities The entities to delete (returned from importEntitiesFromYaml)
 */
export async function cleanupImportedEntities(
  api: ApiClient,
  entities: ImportedEntities,
): Promise<void> {
  // // Delete deployments
  // for (const deployment of entities.deployments) {
  //   console.log(`Deleting deployment: ${deployment.name}`);
  //   await api.DELETE(`/v1/deployments/${deployment.id}`);
  // }
  // // Delete environments
  // for (const environment of entities.environments) {
  //   console.log(`Deleting environment: ${environment.name}`);
  //   await api.DELETE(`/v1/environments/${environment.id}`);
  // }
  // for (const policy of entities.policies) {
  //   console.log(`Deleting policy: ${policy.name}`);
  //   await api.DELETE(`/v1/policies/${policy.id}`);
  // }
  // // Delete system (this should cascade delete related resources)
  // console.log(`Deleting system: ${entities.system.name}`);
  // await api.DELETE(`/v1/systems/${entities.system.id}`);
}
