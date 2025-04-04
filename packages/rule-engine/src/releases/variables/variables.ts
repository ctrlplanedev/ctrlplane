import type { Tx } from "@ctrlplane/db";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { ReleaseTargetIdentifer } from "../../types.js";
import type { MaybeVariable, VariableProvider } from "./types.js";
import {
  DatabaseDeploymentVariableProvider,
  DatabaseResourceVariableProvider,
  DatabaseSystemVariableSetProvider,
} from "./db-variable-providers.js";

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
  static async database(options: ReleaseTargetIdentifer) {
    const providers = [
      new DatabaseSystemVariableSetProvider(options),
      new DatabaseResourceVariableProvider(options),
      new DatabaseDeploymentVariableProvider(options),
    ];

    const keys = await getDeploymentVariableKeys(options);
    return new VariableManager({ ...options, keys }, providers);
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
    return Promise.all(this.options.keys.map((key) => this.getVariable(key)));
  }

  async getVariable(key: string): Promise<MaybeVariable> {
    for (const provider of this.variableProviders) {
      const variable = await provider.getVariable(key);
      if (variable) return variable;
    }
    return null;
  }
}
