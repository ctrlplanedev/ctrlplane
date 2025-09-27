import type { Tx } from "@ctrlplane/db";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";

import type { ReleaseTargetIdentifier } from "../../types.js";
import type { MaybeVariable, VariableProvider } from "./types.js";
import {
  DatabaseDeploymentVariableProvider,
  DatabaseResourceVariableProvider,
  DatabaseSystemVariableSetProvider,
} from "./db-variable-providers.js";

const log = logger.child({ component: "variable-manager" });

const getDeploymentVariableKeys = async (options: {
  deploymentId: string;
  db?: Tx;
}): Promise<string[]> => {
  const tx = options.db ?? db;
  return tx
    .select({ key: schema.deploymentVariable.key })
    .from(schema.deploymentVariable)
    .where(eq(schema.deploymentVariable.deploymentId, options.deploymentId))
    .then((results) => results.map((r) => r.key));
};

type VariableManagerOptions = {
  keys: string[];
};

export class VariableManager {
  static async database(options: ReleaseTargetIdentifier) {
    const providers = [
      new DatabaseSystemVariableSetProvider(options),
      new DatabaseResourceVariableProvider(options),
      new DatabaseDeploymentVariableProvider(options),
    ];

    const keys = await getDeploymentVariableKeys(options);
    return new VariableManager({ ...options, keys }, providers);
  }

  static create(
    options: VariableManagerOptions,
    providers: VariableProvider[],
  ) {
    return new VariableManager(options, providers);
  }

  private constructor(
    private options: VariableManagerOptions,
    private variableProviders: VariableProvider[],
  ) {}

  getProviders() {
    return [...this.variableProviders];
  }

  addProvider(provider: VariableProvider) {
    this.variableProviders.push(provider);
    return this;
  }

  async getVariables(): Promise<MaybeVariable[]> {
    const variables = [];
    for (const key of this.options.keys) {
      const variable = await this.getVariable(key);
      if (variable) variables.push(variable);
    }
    return variables;
  }

  async getVariable(key: string): Promise<MaybeVariable> {
    const now = performance.now();
    for (const provider of this.variableProviders) {
      const now = performance.now();
      const variable = await provider.getVariable(key);
      const end = performance.now();
      const duration = end - now;
      log.info(
        `Variable ${key} resolution took ${duration.toFixed(2)}ms for provider ${provider.constructor.name}`,
      );
      if (variable) return variable;
    }
    const end = performance.now();
    const duration = end - now;
    log.info(`Variable ${key} resolution took ${duration.toFixed(2)}ms`);
    return { key, value: null, sensitive: false };
  }
}
