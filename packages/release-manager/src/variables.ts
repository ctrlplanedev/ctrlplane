import type { Tx } from "@ctrlplane/db";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { MaybeVariable, VariableProvider } from "./types";
import {
  DatabaseDeploymentVariableProvider,
  DatabaseResourceVariableProvider,
  DatabaseSystemVariableSetProvider,
} from "./db-variable-providers.js";

type VariableManagerOptions = {
  deploymentId: string;
  resourceId: string;
  environmentId: string;

  keys: string[];
};

type DatabaseVariableManagerOptions = Omit<VariableManagerOptions, "keys"> & {
  db?: Tx;
};

export class VariableManager {
  static async database(options: DatabaseVariableManagerOptions) {
    const { deploymentId } = options;
    const tx = options.db ?? db;
    const keys = await tx
      .select({ key: schema.deploymentVariable.key })
      .from(schema.deploymentVariable)
      .where(eq(schema.deploymentVariable.deploymentId, deploymentId))
      .then((results) => results.map((r) => r.key));

    const providers = [
      new DatabaseResourceVariableProvider(options),
      new DatabaseDeploymentVariableProvider(options),
      new DatabaseSystemVariableSetProvider(options),
    ];

    return new VariableManager({ ...options, keys }, providers);
  }

  constructor(
    private options: VariableManagerOptions,
    private variableProviders: VariableProvider[],
  ) {}

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
