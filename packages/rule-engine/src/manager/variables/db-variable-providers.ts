import type { Tx } from "@ctrlplane/db";
import type { VariableSetValue } from "@ctrlplane/db/schema";

import {
  and,
  asc,
  eq,
  getDeploymentVariables,
  getResolvedDirectValue,
  selector,
} from "@ctrlplane/db";
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
  directValues: schema.DirectDeploymentVariableValue[];
  referenceValues: schema.ReferenceDeploymentVariableValue[];
  defaultValue?: schema.DeploymentVariableValue | null;
};

export class DatabaseDeploymentVariableProvider implements VariableProvider {
  private db: Tx;
  private variables: Promise<DeploymentVariable[]> | null = null;

  constructor(private options: DatabaseDeploymentVariableOptions) {
    this.db = options.db ?? db;
  }

  private getVariables() {
    return (this.variables ??= getDeploymentVariables(
      this.db,
      this.options.deploymentId,
    ));
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

  /**
   * @param key - The key of the variable to get.
   * @returns The variable with the given key, or null if the variable does not exist.
   * Order of precedence:
   * 1. Direct value -> these are already sorted by value
   * 2. Reference value -> these are already sorted by reference
   * 3. Default value -> this is the last resort
   *
   */
  async getVariable(key: string): Promise<MaybeVariable> {
    const variables = await this.getVariables();
    const variable = variables.find((v) => v.key === key) ?? null;
    if (variable == null) return null;

    const { directValues, referenceValues, defaultValue } = variable;

    for (const directValue of directValues) {
      const isSelectingResource = await this.isSelectingResource(directValue);
      if (!isSelectingResource) continue;

      const resolvedValue = getResolvedDirectValue(directValue);
      return {
        id: variable.id,
        key,
        value: resolvedValue,
        sensitive: directValue.sensitive,
      };
    }

    for (const referenceValue of referenceValues) {
      const resolvedValue = await getReferenceVariableValue(
        this.options.resourceId,
        referenceValue,
      );
      return {
        id: variable.id,
        key,
        value: resolvedValue,
        sensitive: false,
      };
    }

    if (defaultValue == null) return null;
    if (schema.isDeploymentVariableValueDirect(defaultValue)) {
      const resolvedValue = getResolvedDirectValue(defaultValue);
      return {
        id: variable.id,
        key,
        value: resolvedValue,
        sensitive: defaultValue.sensitive,
      };
    }

    if (schema.isDeploymentVariableValueReference(defaultValue)) {
      const resolvedValue = await getReferenceVariableValue(
        this.options.resourceId,
        defaultValue,
      );
      return {
        id: variable.id,
        key,
        value: resolvedValue,
        sensitive: false,
      };
    }

    return {
      id: variable.id,
      key,
      value: null,
      sensitive: false,
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
