import fs from "fs";
import path from "path";
import { faker } from "@faker-js/faker";
import { compile } from "handlebars";
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
    metadata?: Record<string, string>;
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
  const template = compile(fileContent);
  const fileTemplated = template({
    prefix: faker.string.alphanumeric(6),
  });
  let data = yaml.load(fileTemplated) as TestYamlFile;

  // Initialize result object
  const result: ImportedEntities = {
    system: { id: "", name: "", slug: "" },
    environments: [],
    resources: [],
    deployments: [],
    policies: [],
  };

  // Create system
  console.log(`Creating system: ${data.system.name}`);
  const systemResponse = await api.POST("/v1/systems", {
    body: {
      workspaceId,
      ...data.system,
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
  if (data.resources && data.resources.length > 0) {
    console.log(`Creating ${data.resources.length} resources`);

    const resourcesResponse = await api.POST("/v1/resources", {
      body: {
        workspaceId,
        resources: data.resources.map((resource) => ({
          ...resource,
          config: resource.config as Record<string, never>,
        })),
      },
    });

    if (resourcesResponse.response.status !== 200) {
      throw new Error(
        `Failed to create resources: ${JSON.stringify(resourcesResponse.error)}`,
      );
    }

    // Store created resources in result
    result.resources = data.resources.map((resource) => ({
      ...resource,
      originalIdentifier: resource.identifier,
    }));
  }

  // Create environments with prefixes if needed
  if (data.environments && data.environments.length > 0) {
    for (const env of data.environments) {
      console.log(`Creating environment: ${env.name}`);

      // Update resource selector if needed
      let resourceSelector = env.resourceSelector;

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
      console.log(`Creating deployment: ${deployment.name}`);

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
      console.log(`Creating policy: ${policy.name}`);

      const policyResponse = await api.POST("/v1/policies", {
        body: {
          ...policy,
          workspaceId,
        },
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
  for (const policy of entities.policies) {
    console.log(`Deleting policy: ${policy.name}`);
    await api.DELETE(`/v1/policies/{policyId}`, {
      params: { path: { policyId: policy.id } },
    });
  }

  for (const deployment of entities.deployments) {
    console.log(`Deleting deployment: ${deployment.name}`);
    await api.DELETE(`/v1/deployments/{deploymentId}`, {
      params: { path: { deploymentId: deployment.id } },
    });
  }

  for (const environment of entities.environments) {
    console.log(`Deleting environment: ${environment.name}`);
    await api.DELETE(`/v1/environments/{environmentId}`, {
      params: { path: { environmentId: environment.id } },
    });
  }

  console.log(`Deleting system: ${entities.system.name}`);
  await api.DELETE(`/v1/systems/{systemId}`, {
    params: { path: { systemId: entities.system.id } },
  });
}
