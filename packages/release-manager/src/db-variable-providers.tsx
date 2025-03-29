import type { Tx } from "@ctrlplane/db";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  deploymentVariable,
  resource,
  resourceMatchesMetadata,
  resourceVariable,
} from "@ctrlplane/db/schema";

import type { MaybeVariable, Variable, VariableProvider } from "./types";

export type DatabaseResourceVariableOptions = {
  resourceId: string;
  db?: Tx;
};

export class DatabaseResourceVariableProvider implements VariableProvider {
  private db: Tx;
  private variables: Promise<Variable[]> | null = null;

  constructor(private options: DatabaseResourceVariableOptions) {
    this.db = options.db ?? db;
  }

  private async loadVariables() {
    const variables = await this.db.query.resourceVariable.findMany({
      where: and(eq(resourceVariable.resourceId, this.options.resourceId)),
    });
    return variables.map((v) => ({
      id: v.id,
      key: v.key,
      value: v.value,
      sensitive: v.sensitive,
    }));
  }

  private getVariablesPromise() {
    return (this.variables ??= this.loadVariables());
  }

  async getVariable(key: string): Promise<MaybeVariable> {
    const variables = await this.getVariablesPromise();
    return variables.find((v) => v.key === key) ?? null;
  }
}

export type DatabaseDeploymentVariableOptions = {
  resourceId: string;
  deploymentId: string;
  keys: string[];
  db?: Tx;
};

type DeploymentVariableValue = {
  value: any;
  resourceSelector: any;
  sensitive: boolean;
};

type DeploymentVariable = {
  id: string;
  key: string;
  value: string;
  sensitive: boolean;
  defaultValue: DeploymentVariableValue | null;
  values: DeploymentVariableValue[];
};

export class DatabaseDeploymentVariableProvider implements VariableProvider {
  private db: Tx;
  private variables: Promise<DeploymentVariable[]> | null = null;

  constructor(private options: DatabaseDeploymentVariableOptions) {
    this.db = options.db ?? db;
  }

  private loadVariables() {
    return this.db.query.deploymentVariable.findMany({
      where: eq(deploymentVariable.deploymentId, this.options.deploymentId),
      with: {
        defaultValue: true,
        values: true,
      },
    });
  }

  private getVariables() {
    return (this.variables ??= this.loadVariables());
  }

  async getVariable(key: string): Promise<MaybeVariable> {
    const variables = await this.getVariables();
    const variable = variables.find((v) => v.key === key) ?? null;
    if (variable == null) return null;

    for (const value of variable.values) {
      const res = await this.db
        .select()
        .from(resource)
        .where(
          and(
            eq(resource.id, this.options.resourceId),
            resourceMatchesMetadata(this.db, value.resourceSelector),
          ),
        )
        .then(takeFirstOrNull);

      if (res != null)
        return {
          id: variable.id,
          key,
          ...value,
        };
    }

    if (variable.defaultValue != null)
      return {
        id: variable.id,
        key,
        ...variable.defaultValue,
      };

    return null;
  }
}
