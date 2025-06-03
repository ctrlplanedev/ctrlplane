import { faker } from "@faker-js/faker";

import { WorkspaceFixture } from "../tests/auth.setup";
import { EntityFixtures, importEntityFixtures } from "./entity-fixtures";
import { ApiClient } from "./index";
import { EntityRefs } from "./entity-refs";
import { FetchResponse } from "openapi-fetch";

export interface FetchResultInfo {
  fetchResponse: FetchResponse<any, any, any>;
  requestBody?: any;
}

export class EntitiesBuilder {
  public readonly refs: EntityRefs;
  private readonly fixtures: EntityFixtures;

  /**
   * Import entities from a YAML file into the workspace
   * @param api API client instance
   * @param workspace workspace fixture to import into
   * @param yamlFilePath Path to the YAML file (absolute or relative to the execution directory)
   * @param existingRefs If building from a previous EntitiesBuilder
   */
  constructor(
    public readonly api: ApiClient,
    public readonly workspace: WorkspaceFixture,
    public readonly yamlFilePath: string,
    existingRefs: EntityRefs | undefined = undefined,
  ) {
    console.debug(`EntityBuilder workspaceId: ${workspace.id}`);
    if (!existingRefs) {
      const system = {
        id: "",
        name: "",
        slug: "",
      };
      this.refs = new EntityRefs(
        faker.string.alphanumeric(6),
        system,
      );
    } else {
      this.refs = existingRefs;
    }
    console.log("Creating entities from YAML:", yamlFilePath);
    this.fixtures = importEntityFixtures(yamlFilePath, this.refs.prefix);
  }

  async upsertSystem(): Promise<FetchResultInfo> {
    console.log(`Creating system: ${this.fixtures.system.name}`);

    const workspaceId = this.workspace.id;
    const requestBody = {
      workspaceId,
      ...this.fixtures.system,
    };

    const fetchResponse = await this.api.POST("/v1/systems", {
      body: requestBody,
    });

    if (fetchResponse.response.status !== 201) {
      throw new Error(
        `Failed to create system: ${JSON.stringify(fetchResponse.error)}`,
      );
    }

    this.refs.system.id = fetchResponse.data!.id;
    this.refs.system.name = fetchResponse.data!.name;
    this.refs.system.slug = fetchResponse.data!.slug;
    this.refs.system.originalName = this.fixtures.system.name;

    return { requestBody, fetchResponse };
  }

  async upsertResources(): Promise<FetchResultInfo[]> {
    if (!this.fixtures.resources || this.fixtures.resources.length === 0) {
      throw new Error("No resources defined in YAML file");
    }
    let results: FetchResultInfo[] = [];
    const workspaceId = this.workspace.id;

    for (const resource of this.fixtures.resources) {
      console.log(`Creating resource: ${resource.name}`);

      const requestBody = {
        ...resource,
        workspaceId,
        config: resource.config as Record<string, never>,
      };
      const fetchResponse = await this.api.POST("/v1/resources", {
        body: requestBody,
      });

      results.push({
        fetchResponse,
        requestBody,
      });
    }

    // Store created resources in result
    for (const r of this.fixtures.resources) {
      this.refs.resources.push({
        ...r,
        originalIdentifier: r.identifier,
      });
    }

    return results;
  }

  async upsertEnvironments(): Promise<FetchResultInfo[]> {
    if (
      !this.fixtures.environments ||
      this.fixtures.environments.length === 0
    ) {
      throw new Error("No environments defined in YAML file");
    }

    if (!this.refs.system.id || this.refs.system.id.trim() === "") {
      throw new Error(
        "System ID is blank. Please create the system before creating environments.",
      );
    }

    const results: FetchResultInfo[] = [];

    for (const env of this.fixtures.environments) {
      console.log(`Creating environment: ${env.name}`);

      const requestBody = {
        ...env,
        systemId: this.refs.system.id,
      };
      // TODO Update resource selector if needed
      // let resourceSelector = env.resourceSelector;

      const fetchResponse = await this.api.POST("/v1/environments", {
        body: requestBody,
      });

      results.push({
        fetchResponse,
        requestBody,
      });

      this.refs.environments.push({
        id: fetchResponse.data!.id,
        name: fetchResponse.data!.name,
        originalName: env.name,
      });
    }

    return results;
  }

  async upsertDeployments(agentId?: string): Promise<FetchResultInfo[]> {
    if (
      !this.fixtures.deployments || this.fixtures.deployments.length === 0
    ) {
      throw new Error("No deployments defined in YAML file");
    }
    const results: FetchResultInfo[] = [];
    for (const deployment of this.fixtures.deployments) {
      const requestBody = {
        ...deployment,
        systemId: this.refs.system.id,
        jobAgentId: agentId,
      };
      const uriPath = "/v1/deployments";
      const fetchResponse = await this.api.POST(uriPath, {
        body: requestBody,
      });

      this.refs.deployments.push({
        id: fetchResponse.data!.id,
        name: fetchResponse.data!.name,
        slug: fetchResponse.data!.slug,
        originalName: deployment.name,
        versions: [],
        variables: [],
      });

      results.push({
        fetchResponse,
        requestBody,
      });
    }

    return results;
  }

  async createDeploymentVersions(): Promise<FetchResultInfo[]> {
    if (!this.fixtures.deployments || this.fixtures.deployments.length === 0) {
      throw new Error("No deployments defined in YAML file");
    }
    const results: FetchResultInfo[] = [];
    for (const deployment of this.fixtures.deployments) {
      if (deployment.versions && deployment.versions.length > 0) {
        const deploymentResult = this.refs.deployments.find(
          (d) => d.name === deployment.name,
        );
        if (!deploymentResult) {
          throw new Error(`Deployment ${deployment.name} not found in result`);
        }

        for (const version of deployment.versions) {
          const requestBody = {
            ...version,
            deploymentId: deploymentResult.id,
          };
          const fetchResponse = await this.api.POST(
            "/v1/deployment-versions",
            {
              body: requestBody,
            },
          );

          results.push({
            fetchResponse,
            requestBody,
          });

          deploymentResult.versions!.push({
            id: fetchResponse.data!.id,
            name: fetchResponse.data!.name,
            tag: fetchResponse.data!.tag,
            status: fetchResponse.data!.status ?? "ready",
          });
        }
      }
    }
    return results;
  }

  async createDeploymentVariables(): Promise<FetchResultInfo[]> {
    if (!this.fixtures.deployments || this.fixtures.deployments.length === 0) {
      throw new Error("No deployments defined in YAML file");
    }
    const results: FetchResultInfo[] = [];
    for (const deployment of this.fixtures.deployments) {
      if (deployment.variables && deployment.variables.length > 0) {
        const deploymentResult = this.refs.deployments.find(
          (d) => d.name === deployment.name,
        );
        if (!deploymentResult) {
          throw new Error(`Deployment ${deployment.name} not found in result`);
        }

        for (const variable of deployment.variables) {
          const requestBody = {
            ...variable,
          };
          const fetchResponse = await this.api.POST(
            "/v1/deployments/{deploymentId}/variables",
            {
              params: { path: { deploymentId: deploymentResult.id } },
              body: {
                requestBody,
              },
            },
          );

          results.push({
            fetchResponse,
            requestBody,
          });

          deploymentResult.variables!.push({
            id: fetchResponse.data!.id,
            key: fetchResponse.data!.key,
            description: fetchResponse.data!.description,
            config: fetchResponse.data!.config,
            values: fetchResponse.data!.values,
          });
        }
      }
    }
    return results;
  }

  async upsertPolicies(): Promise<FetchResultInfo[]> {
    if (!this.fixtures.policies || this.fixtures.policies.length === 0) {
      throw new Error("No policies defined in YAML file");
    }
    const results: FetchResultInfo[] = [];
    const workspaceId = this.workspace.id;

    for (const policy of this.fixtures.policies) {
      const requestBody = {
        ...policy,
        workspaceId,
      };
      const fetchResponse = await this.api.POST("/v1/policies", {
        body: requestBody,
      });

      results.push({
        fetchResponse,
        requestBody,
      });

      this.refs.policies.push({
        id: fetchResponse.data!.id,
        name: fetchResponse.data!.name,
        originalName: policy.name,
      });
    }

    return results;
  }

  async upsertAgents(): Promise<FetchResultInfo[]> {
    if (!this.fixtures.agents || this.fixtures.agents.length === 0) {
      throw new Error("No agents defined in YAML file");
    }
    const results: FetchResultInfo[] = [];
    const workspaceId = this.workspace.id;

    for (const agent of this.fixtures.agents) {
      const requestBody = {
        ...agent,
        workspaceId,
      };
      const fetchResponse = await this.api.PATCH("/v1/job-agents/name", {
        body: requestBody,
      });

      results.push({
        fetchResponse,
        requestBody,
      });

      this.refs.agents.push({
        id: fetchResponse.data!.id,
        name: fetchResponse.data!.name,
      });
    }
    return results;
  }
}

/**
 * Delete all entities created from a YAML import
 * @param api API client instance
 * @param refs Refs entities to delete (returned from importEntitiesFromYaml)
 */
export async function cleanupImportedEntities(
  api: ApiClient,
  refs: EntityRefs,
  workspaceId: string,
): Promise<FetchResultInfo[]> {
  const results: FetchResultInfo[] = [];
  for (const policy of refs.policies ?? []) {
    results.push({
      fetchResponse: await api.DELETE(`/v1/policies/{policyId}`, {
        params: { path: { policyId: policy.id } },
      }),
    });
  }

  for (const deployment of refs.deployments ?? []) {
    results.push({
      fetchResponse: await api.DELETE(`/v1/deployments/{deploymentId}`, {
        params: { path: { deploymentId: deployment.id } },
      }),
    });
  }

  for (const environment of refs.environments ?? []) {
    results.push({
      fetchResponse: await api.DELETE(`/v1/environments/{environmentId}`, {
        params: { path: { environmentId: environment.id } },
      }),
    });
  }

  results.push({
    fetchResponse: await api.DELETE(`/v1/systems/{systemId}`, {
      params: { path: { systemId: refs.system.id } },
    }),
  });

  for (const resource of refs.resources ?? []) {
    results.push({
      fetchResponse: await api.DELETE(
        "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
        {
          params: {
            path: { workspaceId: workspaceId, identifier: resource.identifier },
          },
        },
      ),
    });
  }
  return results;
}
