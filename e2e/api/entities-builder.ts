import { faker } from "@faker-js/faker";

import { WorkspaceFixture } from "../tests/auth.setup";
import { EntityFixtures, importEntityFixtures } from "./entity-fixtures";
import { ApiClient } from "./index";
import { EntityRefs } from "./entity-refs";

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

  async upsertSystem() {
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

    this.refs.system.id = systemResponse.data!.id;
    this.refs.system.name = systemResponse.data!.name;
    this.refs.system.slug = systemResponse.data!.slug;
    this.refs.system.originalName = this.fixtures.system.name;
  }

  async upsertResources() {
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
      this.refs.resources.push({
        ...r,
        originalIdentifier: r.identifier,
      });
    }
  }

  async upsertEnvironments() {
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

    for (const env of this.fixtures.environments) {
      console.log(`Creating environment: ${env.name}`);

      // TODO Update resource selector if needed
      // let resourceSelector = env.resourceSelector;

      const envResponse = await this.api.POST("/v1/environments", {
        body: {
          ...env,
          systemId: this.refs.system.id,
        },
      });

      if (envResponse.response.status !== 200) {
        throw new Error(
          `Failed to create environment: ${JSON.stringify(envResponse.error)}`,
        );
      }

      this.refs.environments.push({
        id: envResponse.data!.id,
        name: envResponse.data!.name,
        originalName: env.name,
      });
    }
  }

  async upsertDeployments(agentId?: string) {
    if (!this.fixtures.deployments || this.fixtures.deployments.length === 0) {
      throw new Error("No deployments defined in YAML file");
    }
    for (const deployment of this.fixtures.deployments) {
      console.log(`Creating deployment: ${deployment.name}`);

      const deploymentResponse = await this.api.POST("/v1/deployments", {
        body: {
          ...deployment,
          systemId: this.refs.system.id,
          jobAgentId: agentId,
        },
      });

      if (![200, 201].includes(deploymentResponse.response.status)) {
        throw new Error(
          `Failed to upsert deployment: ${
            JSON.stringify(
              deploymentResponse.error,
            )
          }`,
        );
      }
      this.refs.deployments.push({
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

        const deploymentResult = this.refs.deployments.find(
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

        const deploymentResult = this.refs.deployments.find(
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

  async upsertPolicies() {
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

      this.refs.policies.push({
        id: policyResponse.data!.id,
        name: policyResponse.data!.name,
        originalName: policy.name,
      });
    }
  }

  async upsertAgents() {
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

      this.refs.agents.push({
        id: agentResponse.data!.id,
        name: agentResponse.data!.name,
      });
    }
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
): Promise<void> {
  for (const policy of refs.policies ?? []) {
    console.log(`Deleting policy: ${policy.name}`);
    await api.DELETE(`/v1/policies/{policyId}`, {
      params: { path: { policyId: policy.id } },
    });
  }

  for (const deployment of refs.deployments ?? []) {
    console.log(`Deleting deployment: ${deployment.name}`);
    await api.DELETE(`/v1/deployments/{deploymentId}`, {
      params: { path: { deploymentId: deployment.id } },
    });
  }

  for (const environment of refs.environments ?? []) {
    console.log(`Deleting environment: ${environment.name}`);
    await api.DELETE(`/v1/environments/{environmentId}`, {
      params: { path: { environmentId: environment.id } },
    });
  }

  console.log(`Deleting system: ${refs.system.name}`);
  await api.DELETE(`/v1/systems/{systemId}`, {
    params: { path: { systemId: refs.system.id } },
  });

  for (const resource of refs.resources ?? []) {
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
