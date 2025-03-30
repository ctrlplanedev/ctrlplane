import type { Tx } from "@ctrlplane/db";
import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import { 
  DatabaseDeploymentVariableProvider, 
  DatabaseResourceVariableProvider, 
  DatabaseSystemVariableSetProvider 
} from "../db-variable-providers.js";
import type { ReleaseIdentifier, VariableProviderFactory, VariableProviderOptions } from "../types.js";

export class ResourceVariableProviderFactory implements VariableProviderFactory {
  create(options: VariableProviderOptions) {
    return new DatabaseResourceVariableProvider(options);
  }
}

export class DeploymentVariableProviderFactory implements VariableProviderFactory {
  create(options: VariableProviderOptions) {
    return new DatabaseDeploymentVariableProvider(options);
  }
}

export class SystemVariableSetProviderFactory implements VariableProviderFactory {
  create(options: VariableProviderOptions) {
    return new DatabaseSystemVariableSetProvider(options);
  }
}

export class DefaultVariableProviderRegistry {
  private providers: VariableProviderFactory[] = [
    new ResourceVariableProviderFactory(),
    new DeploymentVariableProviderFactory(),
    new SystemVariableSetProviderFactory(),
  ];

  register(factory: VariableProviderFactory) {
    this.providers.push(factory);
  }

  getFactories() {
    return [...this.providers];
  }
}

export async function getDeploymentVariableKeys(options: Pick<ReleaseIdentifier, 'deploymentId'> & { db?: Tx }): Promise<string[]> {
  const tx = options.db ?? db;
  return tx
    .select({ key: schema.deploymentVariable.key })
    .from(schema.deploymentVariable)
    .where(eq(schema.deploymentVariable.deploymentId, options.deploymentId))
    .then((results) => results.map((r) => r.key));
}