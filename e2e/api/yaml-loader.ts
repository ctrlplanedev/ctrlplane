import fs from "fs";
import path from "path";
import { faker } from "@faker-js/faker";
import { compile } from "handlebars";
import yaml from "js-yaml";

import { ApiClient } from "./index";
import { WorkspaceFixture } from "../tests/auth.setup";

// YAML structure used to create test entities
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
    versions?: Array<{
      tag: string;
      name?: string;
      config?: Record<string, any>;
      metadata?: Record<string, string>;
      status?: "building" | "ready" | "failed";
      message?: string;
    }>;
    variables?: Array<{
      key: string;
      description?: string;
      config: Record<string, any>;
      values?: Array<{
        value: any;
        valueType?: "direct" | "reference";
        sensitive?: boolean;
        resourceSelector?: any;
        default?: boolean;
      }>;
    }>;
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

// Entities info -- after creation
export interface TestEntities {
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
}

export class EntitiesBuilder {
  public readonly result: TestEntities;
  private readonly data: TestYamlFile;

  /**
   * Import entities from a YAML file into the workspace
   * @param api API client instance
   * @param workspace workspace fixture to import into
   * @param yamlFilePath Path to the YAML file (absolute or relative to the execution directory)
   * @param existingEntities If building from a previous EntitiesBuilder
   */
  constructor(
    public readonly api: ApiClient,
    public readonly workspace: WorkspaceFixture,
    public readonly yamlFilePath: string,
    existingEntities: TestEntities | undefined = undefined,
  ) {
    const resolvedPath = path.isAbsolute(yamlFilePath)
      ? yamlFilePath
      : path.resolve(process.cwd(), yamlFilePath);

    const fileContent = fs.readFileSync(resolvedPath, "utf8");
    const template = compile(fileContent);
    const prefix = faker.string.alphanumeric(6);
    const fileTemplated = template({ prefix });
    this.data = yaml.load(fileTemplated) as TestYamlFile;

    if (!existingEntities) {
      this.result = {
        prefix,
        system: { id: "", name: "", slug: "" },
        environments: [],
        resources: [],
        deployments: [],
        policies: [],
      };
    } else {
      this.result = existingEntities;
    }
  }

  async createSystem() {
    console.log(`Creating system: ${this.data.system.name}`);

    const workspaceId = this.workspace.id;

    const systemResponse = await this.api.POST("/v1/systems", {
      body: {
        workspaceId,
        ...this.data.system,
      },
    });

    if (systemResponse.response.status !== 201) {
      throw new Error(
        `Failed to create system: ${JSON.stringify(systemResponse.error)}`,
      );
    }

    this.result.system = {
      id: systemResponse.data!.id,
      name: systemResponse.data!.name,
      slug: systemResponse.data!.slug,
      originalName: this.data.system.name,
    };
  }

  async createResources() {
    if (!this.data.resources || this.data.resources.length === 0) {
      throw new Error("No resources defined in YAML file");
    }
    const workspaceId = this.workspace.id;

    for (const resource of this.data.resources) {
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
            JSON.stringify(resourceResponse.error)
          }`,
        );
      }
    }

    // Store created resources in result
    for (const r of this.data.resources) {
      this.result.resources.push({
        ...r,
        originalIdentifier: r.identifier,
      });
    }
  }

  async createEnvironments() {
    if (!this.data.environments || this.data.environments.length === 0) {
      throw new Error("No environments defined in YAML file");
    }

    if (!this.result.system.id || this.result.system.id.trim() === "") {
      throw new Error(
        "System ID is blank. Please create the system before creating environments.",
      );
    }

    for (const env of this.data.environments) {
      console.log(`Creating environment: ${env.name}`);

      // TODO Update resource selector if needed
      // let resourceSelector = env.resourceSelector;

      const envResponse = await this.api.POST("/v1/environments", {
        body: {
          ...env,
          systemId: this.result.system.id,
        },
      });

      if (envResponse.response.status !== 200) {
        throw new Error(
          `Failed to create environment: ${JSON.stringify(envResponse.error)}`,
        );
      }

      this.result.environments.push({
        id: envResponse.data!.id,
        name: envResponse.data!.name,
        originalName: env.name,
      });
    }
  }

  async createDeployments() {
    if (!this.data.deployments || this.data.deployments.length === 0) {
      throw new Error("No deployments defined in YAML file");
    }
    for (const deployment of this.data.deployments) {
      console.log(`Creating deployment: ${deployment.name}`);

      const deploymentResponse = await this.api.POST("/v1/deployments", {
        body: {
          ...deployment,
          systemId: this.result.system.id,
        },
      });

      if (deploymentResponse.response.status !== 201) {
        throw new Error(
          `Failed to create deployment: ${
            JSON.stringify(deploymentResponse.error)
          }`,
        );
      }
      this.result.deployments.push({
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
    if (!this.data.deployments || this.data.deployments.length === 0) {
      throw new Error("No deployments defined in YAML file");
    }
    for (const deployment of this.data.deployments) {
      if (deployment.versions && deployment.versions.length > 0) {
        console.log(
          `Adding deployment versions: ${deployment.name} -> ${
            deployment.versions.map((v) => v.tag).join(", ")
          }`,
        );

        const deploymentResult = this.result.deployments.find(
          (d) => d.name === deployment.name,
        );
        if (!deploymentResult) {
          throw new Error(
            `Deployment ${deployment.name} not found in result`,
          );
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
                JSON.stringify(versionResponse.error)
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
    if (!this.data.deployments || this.data.deployments.length === 0) {
      throw new Error("No deployments defined in YAML file");
    }
    for (const deployment of this.data.deployments) {
      if (deployment.variables && deployment.variables.length > 0) {
        console.log(
          `Adding deployment variables: ${deployment.name} -> ${
            deployment.variables.map((v) => v.key).join(", ")
          }`,
        );

        const deploymentResult = this.result.deployments.find(
          (d) => d.name === deployment.name,
        );
        if (!deploymentResult) {
          throw new Error(
            `Deployment ${deployment.name} not found in result`,
          );
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
                JSON.stringify(variableResponse.error)
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
    if (!this.data.policies || this.data.policies.length === 0) {
      throw new Error("No policies defined in YAML file");
    }

    const workspaceId = this.workspace.id;

    for (const policy of this.data.policies) {
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

      this.result.policies.push({
        id: policyResponse.data!.id,
        name: policyResponse.data!.name,
        originalName: policy.name,
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
  entities: TestEntities,
  workspaceId: string,
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

  for (const resource of entities.resources) {
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
