import type { Tx } from "@ctrlplane/db";
import type { VariableSetValue } from "@ctrlplane/db/schema";

import { and, asc, eq, selector } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { ReleaseTargetIdentifier } from "../../types.js";
import type { MaybeVariable, Variable, VariableProvider } from "./types.js";
import { getReferenceVariableValue } from "./resolve-reference-variable.js";

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
      where: eq(schema.resourceVariable.resourceId, this.options.resourceId),
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
  deploymentId: string;
  resourceId: string;
  db?: Tx;
};

type DeploymentVariable = {
  id: string;
  key: string;
  defaultValue: schema.DeploymentVariableValue | null;
  values: schema.DeploymentVariableValue[];
};

export class DatabaseDeploymentVariableProvider implements VariableProvider {
  private db: Tx;
  private variables: Promise<DeploymentVariable[]> | null = null;

  constructor(private options: DatabaseDeploymentVariableOptions) {
    this.db = options.db ?? db;
  }

  private loadVariables() {
    return this.db.query.deploymentVariable.findMany({
      where: eq(
        schema.deploymentVariable.deploymentId,
        this.options.deploymentId,
      ),
      with: {
        defaultValue: true,
        values: { orderBy: [asc(schema.deploymentVariableValue.value)] },
      },
    });
  }

  private getVariables() {
    return (this.variables ??= this.loadVariables());
  }

  async isSelectingResource(value: schema.DeploymentVariableValue) {
    if (value.resourceSelector == null) return false;

    const resourceMatch = await this.db.query.resource.findFirst({
      where: and(
        eq(schema.resource.id, this.options.resourceId),
        selector().query().resources().where(value.resourceSelector).sql(),
      ),
    });

    return resourceMatch != null;
  }

  async resolveVariableValue(value: schema.DeploymentVariableValue) {
    const isDirect = schema.isDeploymentVariableValueDirect(value);
    if (isDirect) return { resolved: true, value: value.value };

    const isReference = schema.isDeploymentVariableValueReference(value);
    if (isReference)
      return {
        resolved: true,
        value: await getReferenceVariableValue(this.options.resourceId, value),
      };

    return { resolved: false, value: null };
  }

  async getVariable(key: string): Promise<MaybeVariable> {
    const variables = await this.getVariables();
    const variable = variables.find((v) => v.key === key) ?? null;
    if (variable == null) return null;

    for (const value of variable.values) {
      const isSelectingResource = await this.isSelectingResource(value);
      if (!isSelectingResource) continue;

      const { resolved, value: resolvedValue } =
        await this.resolveVariableValue(value);
      if (!resolved) continue;

      return {
        id: variable.id,
        key,
        value: resolvedValue,
        sensitive: value.sensitive,
      };
    }

    if (variable.defaultValue == null) return null;

    const { resolved, value: resolvedValue } = await this.resolveVariableValue(
      variable.defaultValue,
    );
    if (!resolved) return null;

    return {
      id: variable.id,
      key,
      value: resolvedValue,
      sensitive: variable.defaultValue.sensitive,
    };
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
      .from(schema.variableSetValue)
      .innerJoin(
        schema.variableSetEnvironment,
        eq(
          schema.variableSetValue.variableSetId,
          schema.variableSetEnvironment.variableSetId,
        ),
      )
      .where(
        eq(
          schema.variableSetEnvironment.environmentId,
          this.options.environmentId,
        ),
      )
      .orderBy(asc(schema.variableSetValue.value))
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
