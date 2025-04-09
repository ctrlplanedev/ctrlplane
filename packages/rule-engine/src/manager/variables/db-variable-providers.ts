import type { Tx } from "@ctrlplane/db";
import type { VariableSetValue } from "@ctrlplane/db/schema";

import { and, asc, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  deploymentVariable,
  deploymentVariableValue,
  resource,
  resourceMatchesMetadata,
  resourceVariable,
  variableSetEnvironment,
  variableSetValue,
} from "@ctrlplane/db/schema";

import type { ReleaseTargetIdentifier } from "../../types.js";
import type { MaybeVariable, Variable, VariableProvider } from "./types.js";

export type DatabaseResourceVariableOptions = Pick<
  ReleaseTargetIdentifier,
  "resourceId"
> & {
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

export type DatabaseDeploymentVariableOptions = Pick<
  ReleaseTargetIdentifier,
  "resourceId" | "deploymentId"
> & {
  db?: Tx;
};

type DeploymentVariableValue = {
  value: any;
  resourceSelector: any;
};

type DeploymentVariable = {
  id: string;
  key: string;
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
        values: { orderBy: [asc(deploymentVariableValue.value)] },
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
      if (value.resourceSelector == null) continue;
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
          sensitive: false,
          ...value,
        };
    }

    if (variable.defaultValue != null)
      return {
        id: variable.id,
        key,
        sensitive: false,
        ...variable.defaultValue,
      };

    return null;
  }
}

export type DatabaseSystemVariableSetOptions = Pick<
  ReleaseTargetIdentifier,
  "environmentId"
> & {
  db?: Tx;
};

export class DatabaseSystemVariableSetProvider implements VariableProvider {
  private db: Tx;
  private variables: Promise<VariableSetValue[]> | null = null;

  constructor(private options: DatabaseSystemVariableSetOptions) {
    this.db = options.db ?? db;
  }

  private loadVariables() {
    return this.db
      .select()
      .from(variableSetValue)
      .innerJoin(
        variableSetEnvironment,
        eq(
          variableSetValue.variableSetId,
          variableSetEnvironment.variableSetId,
        ),
      )
      .where(
        eq(variableSetEnvironment.environmentId, this.options.environmentId),
      )
      .orderBy(asc(variableSetValue.value))
      .then((rows) => rows.map((r) => r.variable_set_value));
  }

  private getVariables() {
    return (this.variables ??= this.loadVariables());
  }

  async getVariable(key: string): Promise<MaybeVariable> {
    const variables = await this.getVariables();
    const variable = variables.find((v) => v.key === key) ?? null;
    if (variable == null) return null;
    return {
      id: variable.id,
      key,
      value: variable.value,
      sensitive: false,
    };
  }
}
