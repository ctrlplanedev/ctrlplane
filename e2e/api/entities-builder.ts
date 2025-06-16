import { faker } from "@faker-js/faker";
import { FetchResponse } from "openapi-fetch";

import { WorkspaceFixture } from "../tests/auth.setup";
import {
  AgentFixture,
  DeploymentFixture,
  EntityFixtures,
  importEntityFixtures,
  ResourceFixture,
} from "./entity-fixtures";
import { EntityRefs } from "./entity-refs";
import { ApiClient } from "./index";

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
      this.refs = new EntityRefs(faker.string.alphanumeric(6), system);
    } else {
      this.refs = existingRefs;
    }
    console.log("Creating entities from YAML:", yamlFilePath);
    this.fixtures = importEntityFixtures(yamlFilePath, this.refs.prefix);
  }

  async upsertSystemFixture(): Promise<FetchResultInfo> {
    console.log(`Upserting system: ${this.fixtures.system.name}`);

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
        `Failed to upsert system: ${JSON.stringify(fetchResponse.error)}`,
      );
    }

    this.refs.system.id = fetchResponse.data!.id;
    this.refs.system.name = fetchResponse.data!.name;
    this.refs.system.slug = fetchResponse.data!.slug;
    this.refs.system.originalName = this.fixtures.system.name;

    return { requestBody, fetchResponse };
  }

  async upsertResourcesFixtures(): Promise<FetchResultInfo[]> {
    if (!this.fixtures.resources || this.fixtures.resources.length === 0) {
      throw new Error("No resources defined in YAML file");
    }
    let results: FetchResultInfo[] = [];
    const workspaceId = this.workspace.id;

    for (const resource of this.fixtures.resources) {
      console.log(`Upserting resource: ${resource.name}`);

      const requestBody = {
        ...resource,
        workspaceId,
        config: resource.config as Record<string, never>,
      };
      //console.debug(JSON.stringify(requestBody, null));
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

  /**
   * Create near-identical copies of the fixtures from the yaml file but they
   * should have distinct names and identifiers (hence they would be new copies).
   */
  async createResourceFixtureClones(): Promise<FetchResultInfo[]> {
    if (!this.fixtures.resources || this.fixtures.resources.length === 0) {
      throw new Error("No resources defined in YAML file");
    }

    const resourceClones: ResourceFixture[] = [];
    for (const resource of this.fixtures.resources) {
      resourceClones.push({
        ...resource,
        name: `${resource.name}-clone-${faker.string.alphanumeric(5)}`,
        identifier: `${resource.identifier}-clone-${faker.string.alphanumeric(5)}`,
      });
    }

    let results: FetchResultInfo[] = [];
    const workspaceId = this.workspace.id;

    for (const resource of resourceClones) {
      console.log(`Creating cloned resource: ${resource.name}`);

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
    for (const r of resourceClones) {
      this.refs.resources.push({
        ...r,
        originalIdentifier: r.identifier,
      });
    }

    return results;
  }

  async upsertEnvironmentFixtures(): Promise<FetchResultInfo[]> {
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
      console.log(`Upserting environment: ${env.name}`);

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

  async upsertDeploymentFixtures(agentId?: string): Promise<FetchResultInfo[]> {
    if (!this.fixtures.deployments || this.fixtures.deployments.length === 0) {
      throw new Error("No deployments defined in YAML file");
    }
    const results: FetchResultInfo[] = [];
    for (const deployment of this.fixtures.deployments) {
      console.debug(
        `Upserting deployment: ${deployment.name} with agentId ${agentId}`,
      );
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

  async createDeploymentFixtureClones(
    agentId?: string,
  ): Promise<FetchResultInfo[]> {
    if (!this.fixtures.deployments || this.fixtures.deployments.length === 0) {
      throw new Error("No deployments defined in YAML file");
    }
    const results: FetchResultInfo[] = [];
    const deploymentClones: DeploymentFixture[] = [];
    for (const deployment of this.fixtures.deployments) {
      deploymentClones.push({
        ...deployment,
        name: `${deployment.name}-clone-${faker.string.alphanumeric(5)}`,
      });
    }

    for (const deployment of deploymentClones) {
      console.debug(
        `Creating cloned deployment: ${deployment.name} with agentId ${agentId}`,
      );
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

  async upsertDeploymentVersionFixtures(): Promise<FetchResultInfo[]> {
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
          console.debug(
            `Upserting deployment version '${version.tag}' on deployment '${deployment.name}'`,
          );
          const requestBody = {
            ...version,
            deploymentId: deploymentResult.id,
          };
          const fetchResponse = await this.api.POST("/v1/deployment-versions", {
            body: requestBody,
          });

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

  async createDeploymentVersionFixtureClone(
    deploymentId: string,
  ): Promise<FetchResultInfo> {
    const deployment = this.refs.deployments.find((d) => d.id === deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }
    const clonedTag = `${deployment.versions![0].tag}-clone-${faker.string.alphanumeric(5)}`;
    console.debug(
      `Creating deployment version '${clonedTag}' on deployment '${deployment.name}'`,
    );
    const requestBody = {
      tag: clonedTag,
      deploymentId: deploymentId,
    };
    const fetchResponse = await this.api.POST("/v1/deployment-versions", {
      body: requestBody,
    });

    deployment.versions!.push({
      id: fetchResponse.data!.id,
      name: fetchResponse.data!.name,
      tag: fetchResponse.data!.tag,
      status: fetchResponse.data!.status ?? "ready",
    });

    return {
      fetchResponse,
      requestBody,
    };
  }

  async upsertDeploymentVariableFixtures(): Promise<FetchResultInfo[]> {
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
          console.debug(
            `Upserting deployment variable '${variable.key}' on deployment '${deployment.name}'`,
          );
          const variableResponse = await this.api.POST(
            "/v1/deployments/{deploymentId}/variables",
            {
              params: { path: { deploymentId: deploymentResult.id } },
              body: {
                ...variable,
                directValues: variable.directValues?.map((dv) => ({
                  ...dv,
                  resourceSelector: dv.resourceSelector ?? null,
                })),
                referenceValues: variable.referenceValues?.map((rv) => ({
                  ...rv,
                  resourceSelector: rv.resourceSelector ?? null,
                })),
              },
            },
          );

          if (variableResponse.response.status !== 201)
            throw new Error(
              `Failed to upsert deployment variable: ${JSON.stringify(
                variableResponse.error,
              )}`,
            );

          const variableData = variableResponse.data!;
          const { directValues, referenceValues } = variableData;
          directValues?.forEach((dv) => {
            dv.id = dv.id ?? faker.string.uuid();
          });
          referenceValues?.forEach((rv) => {
            rv.id = rv.id ?? faker.string.uuid();
          });
          deploymentResult.variables!.push({
            id: variableData.id,
            key: variableData.key,
            description: variableData.description,
            config: variableData.config,
            directValues: directValues,
            referenceValues: referenceValues,
          });
        }
      }
    }
    return results;
  }

  async upsertPolicyFixtures(): Promise<FetchResultInfo[]> {
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

  async upsertAgentFixtures(): Promise<FetchResultInfo[]> {
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

      console.debug(`Upserted agent: ${fetchResponse.data!.name}`);
    }
    return results;
  }

  async createAgentFixtureClones(): Promise<FetchResultInfo[]> {
    if (!this.fixtures.agents || this.fixtures.agents.length === 0) {
      throw new Error("No agents defined in YAML file");
    }
    const results: FetchResultInfo[] = [];
    const workspaceId = this.workspace.id;
    const agentClones: AgentFixture[] = [];
    for (const agent of this.fixtures.agents) {
      agentClones.push({
        ...agent,
        name: `${agent.name}-clone-${faker.string.alphanumeric(5)}`,
      });
    }

    for (const agent of agentClones) {
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

      console.debug(`Created cloned agent: ${fetchResponse.data!.name}`);
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
