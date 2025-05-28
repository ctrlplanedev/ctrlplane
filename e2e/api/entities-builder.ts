import { faker } from "@faker-js/faker";

import { WorkspaceFixture } from "../tests/auth.setup";
import { EntityFixtures, importEntityFixtures } from "./entity-fixtures";
import { ApiClient } from "./index";

// Entities info -- references to entities after built in API
export interface EntitiesCache {
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
    metadata?: Record<string, string>;
  }>;
  deployments: Array<{
    id: string;
    name: string;
    slug: string;
    originalName?: string;
    versions?: Array<{
      id: string;
      name: string;
      tag: string;
      status: "building" | "ready" | "failed";
    }>;
    variables?: Array<{
      id: string;
      key: string;
      description?: string;
      config: Record<string, any>;
      values?: Array<{
        id: string;
        value: any;
        valueType?: "direct" | "reference";
        sensitive?: boolean;
        resourceSelector?: any;
        default?: boolean;
      }>;
    }>;
  }>;
  policies: Array<{
    id: string;
    name: string;
    originalName?: string;
  }>;
  agents: Array<{
    id: string;
    name: string;
  }>;
}

export class EntitiesBuilder {
  public readonly cache: EntitiesCache;
  private readonly fixtures: EntityFixtures;

  /**
   * Import entities from a YAML file into the workspace
   * @param api API client instance
   * @param workspace workspace fixture to import into
   * @param yamlFilePath Path to the YAML file (absolute or relative to the execution directory)
   * @param existingCache If building from a previous EntitiesBuilder
   */
  constructor(
    public readonly api: ApiClient,
    public readonly workspace: WorkspaceFixture,
    public readonly yamlFilePath: string,
    existingCache: EntitiesCache | undefined = undefined,
  ) {
    if (!existingCache) {
      this.cache = {
        prefix: faker.string.alphanumeric(6),
        system: { id: "", name: "", slug: "" },
        environments: [],
        resources: [],
        deployments: [],
        policies: [],
        agents: [],
      };
    } else {
      this.cache = existingCache;
    }
    console.log("Creating entities from YAML:", yamlFilePath);
    this.fixtures = importEntityFixtures(yamlFilePath, this.cache.prefix);
  }

  async createSystem() {
    console.log(`Creating system: ${this.fixtures.system.name}`);

    const workspaceId = this.workspace.id;

    const systemResponse = await this.api.POST("/v1/systems", {
      body: {
        workspaceId,
        ...this.fixtures.system,
      },
    });

    if (systemResponse.response.status !== 201) {
      throw new Error(
        `Failed to create system: ${JSON.stringify(systemResponse.error)}`,
      );
    }

    this.cache.system = {
      id: systemResponse.data!.id,
      name: systemResponse.data!.name,
      slug: systemResponse.data!.slug,
      originalName: this.fixtures.system.name,
    };
  }

  async createResources() {
    if (!this.fixtures.resources || this.fixtures.resources.length === 0) {
      throw new Error("No resources defined in YAML file");
    }
    const workspaceId = this.workspace.id;

    for (const resource of this.fixtures.resources) {
      console.log(`Creating resource: ${resource.name}`);

      const resourceResponse = await this.api.POST("/v1/resources", {
        body: {
          ...resource,
          workspaceId,
          config: resource.config as Record<string, never>,
        },
      });

      if (resourceResponse.response.status !== 200) {
        throw new Error(
          `Failed to create resource: ${
            JSON.stringify(
              resourceResponse.error,
            )
          }`,
        );
      }
    }

    // Store created resources in result
    for (const r of this.fixtures.resources) {
      this.cache.resources.push({
        ...r,
        originalIdentifier: r.identifier,
      });
    }
  }

  async createEnvironments() {
    if (
      !this.fixtures.environments ||
      this.fixtures.environments.length === 0
    ) {
      throw new Error("No environments defined in YAML file");
    }

    if (!this.cache.system.id || this.cache.system.id.trim() === "") {
      throw new Error(
        "System ID is blank. Please create the system before creating environments.",
      );
    }

    for (const env of this.fixtures.environments) {
      console.log(`Creating environment: ${env.name}`);

      // TODO Update resource selector if needed
      // let resourceSelector = env.resourceSelector;

      const envResponse = await this.api.POST("/v1/environments", {
        body: {
          ...env,
          systemId: this.cache.system.id,
        },
      });

      if (envResponse.response.status !== 200) {
        throw new Error(
          `Failed to create environment: ${JSON.stringify(envResponse.error)}`,
        );
      }

      this.cache.environments.push({
        id: envResponse.data!.id,
        name: envResponse.data!.name,
        originalName: env.name,
      });
    }
  }

  async createDeployments() {
    if (!this.fixtures.deployments || this.fixtures.deployments.length === 0) {
      throw new Error("No deployments defined in YAML file");
    }
    for (const deployment of this.fixtures.deployments) {
      console.log(`Creating deployment: ${deployment.name}`);

      const deploymentResponse = await this.api.POST("/v1/deployments", {
        body: {
          ...deployment,
          systemId: this.cache.system.id,
        },
      });

      if (deploymentResponse.response.status !== 201) {
        throw new Error(
          `Failed to create deployment: ${
            JSON.stringify(
              deploymentResponse.error,
            )
          }`,
        );
      }
      this.cache.deployments.push({
        id: deploymentResponse.data!.id,
        name: deploymentResponse.data!.name,
        slug: deploymentResponse.data!.slug,
        originalName: deployment.name,
        versions: [],
        variables: [],
      });
    }
  }

  async createDeploymentVersions() {
    if (!this.fixtures.deployments || this.fixtures.deployments.length === 0) {
      throw new Error("No deployments defined in YAML file");
    }
    for (const deployment of this.fixtures.deployments) {
      if (deployment.versions && deployment.versions.length > 0) {
        console.log(
          `Adding deployment versions: ${deployment.name} -> ${
            deployment.versions
              .map((v) => v.tag)
              .join(", ")
          }`,
        );

        const deploymentResult = this.cache.deployments.find(
          (d) => d.name === deployment.name,
        );
        if (!deploymentResult) {
          throw new Error(`Deployment ${deployment.name} not found in result`);
        }

        for (const version of deployment.versions) {
          const versionResponse = await this.api.POST(
            "/v1/deployment-versions",
            {
              body: {
                ...version,
                deploymentId: deploymentResult.id,
              },
            },
          );

          if (versionResponse.response.status !== 201) {
            throw new Error(
              `Failed to create deployment version: ${
                JSON.stringify(
                  versionResponse.error,
                )
              }`,
            );
          }

          const versionData = versionResponse.data!;
          deploymentResult.versions!.push({
            id: versionData.id,
            name: versionData.name,
            tag: versionData.tag,
            status: versionData.status ?? "ready",
          });
        }
      }
    }
  }

  async createDeploymentVariables() {
    if (!this.fixtures.deployments || this.fixtures.deployments.length === 0) {
      throw new Error("No deployments defined in YAML file");
    }
    for (const deployment of this.fixtures.deployments) {
      if (deployment.variables && deployment.variables.length > 0) {
        console.log(
          `Adding deployment variables: ${deployment.name} -> ${
            deployment.variables
              .map((v) => v.key)
              .join(", ")
          }`,
        );

        const deploymentResult = this.cache.deployments.find(
          (d) => d.name === deployment.name,
        );
        if (!deploymentResult) {
          throw new Error(`Deployment ${deployment.name} not found in result`);
        }

        for (const variable of deployment.variables) {
          const variableResponse = await this.api.POST(
            "/v1/deployments/{deploymentId}/variables",
            {
              params: { path: { deploymentId: deploymentResult.id } },
              body: {
                ...variable,
              },
            },
          );

          if (variableResponse.response.status !== 201) {
            throw new Error(
              `Failed to create deployment variable: ${
                JSON.stringify(
                  variableResponse.error,
                )
              }`,
            );
          }

          const variableData = variableResponse.data!;
          deploymentResult.variables!.push({
            id: variableData.id,
            key: variableData.key,
            description: variableData.description,
            config: variableData.config,
            values: variableData.values,
          });
        }
      }
    }
  }

  async createPolicies() {
    if (!this.fixtures.policies || this.fixtures.policies.length === 0) {
      throw new Error("No policies defined in YAML file");
    }

    const workspaceId = this.workspace.id;

    for (const policy of this.fixtures.policies) {
      console.log(`Creating policy: ${policy.name}`);

      const policyResponse = await this.api.POST("/v1/policies", {
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

      this.cache.policies.push({
        id: policyResponse.data!.id,
        name: policyResponse.data!.name,
        originalName: policy.name,
      });
    }
  }

  async createAgents() {
    if (!this.fixtures.agents || this.fixtures.agents.length === 0) {
      throw new Error("No agents defined in YAML file");
    }

    const workspaceId = this.workspace.id;

    for (const agent of this.fixtures.agents) {
      console.log(`Creating agent: ${agent.name}`);

      const agentResponse = await this.api.PATCH("/v1/job-agents/name", {
        body: {
          ...agent,
          workspaceId,
        },
      });

      if (agentResponse.response.status !== 200) {
        throw new Error(
          `Failed to create agent: ${JSON.stringify(agentResponse.error)}`,
        );
      }

      this.cache.agents.push({
        id: agentResponse.data!.id,
        name: agentResponse.data!.name,
      });
    }
  }
}

/**
 * Delete all entities created from a YAML import
 * @param api API client instance
 * @param entities The entities to delete (returned from importEntitiesFromYaml)
 */
export async function cleanupImportedEntities(
  api: ApiClient,
  entities: EntitiesCache,
  workspaceId: string,
): Promise<void> {
  for (const policy of entities.policies ?? []) {
    console.log(`Deleting policy: ${policy.name}`);
    await api.DELETE(`/v1/policies/{policyId}`, {
      params: { path: { policyId: policy.id } },
    });
  }

  for (const deployment of entities.deployments ?? []) {
    console.log(`Deleting deployment: ${deployment.name}`);
    await api.DELETE(`/v1/deployments/{deploymentId}`, {
      params: { path: { deploymentId: deployment.id } },
    });
  }

  for (const environment of entities.environments ?? []) {
    console.log(`Deleting environment: ${environment.name}`);
    await api.DELETE(`/v1/environments/{environmentId}`, {
      params: { path: { environmentId: environment.id } },
    });
  }

  console.log(`Deleting system: ${entities.system.name}`);
  await api.DELETE(`/v1/systems/{systemId}`, {
    params: { path: { systemId: entities.system.id } },
  });

  for (const resource of entities.resources ?? []) {
    console.log(`Deleting resource: ${resource.identifier}`);
    const response = await api.DELETE(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspaceId, identifier: resource.identifier },
        },
      },
    );

    if (response.response.status !== 200) {
      console.error(
        `Failed to delete resource: ${JSON.stringify(response.error)}`,
      );
    }
  }
}
