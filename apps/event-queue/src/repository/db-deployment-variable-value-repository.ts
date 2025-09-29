import type { Tx } from "@ctrlplane/db";
import { isPresent } from "ts-is-present";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";

import type { Repository } from "./repository";
import { Trace } from "../traces.js";

const log = logger.child({ module: "DbDeploymentVariableValueRepository" });

export class DbDeploymentVariableValueRepository
  implements Repository<schema.DeploymentVariableValue>
{
  private readonly db: Tx;
  private readonly workspaceId: string;
  constructor(workspaceId: string, tx?: Tx) {
    this.db = tx ?? dbClient;
    this.workspaceId = workspaceId;
  }

  async get(id: string) {
    const result = await this.db
      .select()
      .from(schema.deploymentVariableValue)
      .leftJoin(
        schema.deploymentVariableValueDirect,
        eq(
          schema.deploymentVariableValueDirect.variableValueId,
          schema.deploymentVariableValue.id,
        ),
      )
      .leftJoin(
        schema.deploymentVariableValueReference,
        eq(
          schema.deploymentVariableValueReference.variableValueId,
          schema.deploymentVariableValue.id,
        ),
      )
      .innerJoin(
        schema.deploymentVariable,
        eq(
          schema.deploymentVariableValue.variableId,
          schema.deploymentVariable.id,
        ),
      )
      .innerJoin(
        schema.deployment,
        eq(schema.deploymentVariable.deploymentId, schema.deployment.id),
      )
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .where(eq(schema.deploymentVariableValue.id, id))
      .then(takeFirstOrNull);

    if (result == null) return null;

    if (result.deployment_variable_value_direct != null)
      return {
        ...result.deployment_variable_value_direct,
        ...result.deployment_variable_value,
      };

    if (result.deployment_variable_value_reference != null)
      return {
        ...result.deployment_variable_value_reference,
        ...result.deployment_variable_value,
      };

    log.error("Found variable value with no direct or reference value", {
      variableValueId: result.deployment_variable_value.id,
    });
    return null;
  }

  @Trace("db-deployment-variable-value-repository-getAll")
  async getAll() {
    const results = await this.db
      .select()
      .from(schema.deploymentVariableValue)
      .leftJoin(
        schema.deploymentVariableValueDirect,
        eq(
          schema.deploymentVariableValueDirect.variableValueId,
          schema.deploymentVariableValue.id,
        ),
      )
      .leftJoin(
        schema.deploymentVariableValueReference,
        eq(
          schema.deploymentVariableValueReference.variableValueId,
          schema.deploymentVariableValue.id,
        ),
      )
      .innerJoin(
        schema.deploymentVariable,
        eq(
          schema.deploymentVariableValue.variableId,
          schema.deploymentVariable.id,
        ),
      )
      .innerJoin(
        schema.deployment,
        eq(schema.deploymentVariable.deploymentId, schema.deployment.id),
      )
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .where(eq(schema.system.workspaceId, this.workspaceId));

    return results
      .map((result) => {
        if (result.deployment_variable_value_direct != null)
          return {
            ...result.deployment_variable_value_direct,
            ...result.deployment_variable_value,
          };
        if (result.deployment_variable_value_reference != null)
          return {
            ...result.deployment_variable_value_reference,
            ...result.deployment_variable_value,
          };

        log.error("Found variable value with no direct or reference value", {
          variableValueId: result.deployment_variable_value.id,
        });
        return null;
      })
      .filter(isPresent);
  }

  create(entity: schema.DeploymentVariableValue) {
    return this.db.transaction(async (tx) => {
      const baseVariableValue = await tx
        .insert(schema.deploymentVariableValue)
        .values(entity)
        .returning()
        .then(takeFirst);

      if (entity.isDefault)
        await tx
          .update(schema.deploymentVariable)
          .set({ defaultValueId: baseVariableValue.id })
          .where(eq(schema.deploymentVariable.id, entity.variableId));

      if (schema.isDeploymentVariableValueDirect(entity)) {
        const directValue = await tx
          .insert(schema.deploymentVariableValueDirect)
          .values({ variableValueId: baseVariableValue.id, ...entity })
          .returning()
          .then(takeFirst);

        return { ...directValue, ...baseVariableValue };
      }

      const referenceValue = await tx
        .insert(schema.deploymentVariableValueReference)
        .values({ variableValueId: baseVariableValue.id, ...entity })
        .returning()
        .then(takeFirst);

      return { ...referenceValue, ...baseVariableValue };
    });
  }

  update(entity: schema.DeploymentVariableValue) {
    return this.db.transaction(async (tx) => {
      const baseVariableValue = await tx
        .update(schema.deploymentVariableValue)
        .set(entity)
        .where(eq(schema.deploymentVariableValue.id, entity.id))
        .returning()
        .then(takeFirst);

      if (schema.isDeploymentVariableValueReference(entity)) {
        const referenceValue = await tx
          .update(schema.deploymentVariableValueReference)
          .set(entity)
          .where(
            eq(
              schema.deploymentVariableValueReference.variableValueId,
              baseVariableValue.id,
            ),
          )
          .returning()
          .then(takeFirst);

        return { ...referenceValue, ...baseVariableValue };
      }

      const directValue = await tx
        .update(schema.deploymentVariableValueDirect)
        .set(entity)
        .where(
          eq(
            schema.deploymentVariableValueDirect.variableValueId,
            baseVariableValue.id,
          ),
        )
        .returning()
        .then(takeFirst);

      return { ...directValue, ...baseVariableValue };
    });
  }

  delete(id: string) {
    return this.db.transaction(async (tx) => {
      const baseVariableValue = await tx
        .select()
        .from(schema.deploymentVariableValue)
        .where(eq(schema.deploymentVariableValue.id, id))
        .then(takeFirstOrNull);

      if (baseVariableValue == null) return null;

      const directValue = await tx
        .delete(schema.deploymentVariableValueDirect)
        .where(
          eq(
            schema.deploymentVariableValueDirect.variableValueId,
            baseVariableValue.id,
          ),
        )
        .returning()
        .then(takeFirstOrNull);

      const referenceValue = await tx
        .delete(schema.deploymentVariableValueReference)
        .where(
          eq(
            schema.deploymentVariableValueReference.variableValueId,
            baseVariableValue.id,
          ),
        )
        .returning()
        .then(takeFirstOrNull);

      await tx
        .delete(schema.deploymentVariableValue)
        .where(eq(schema.deploymentVariableValue.id, baseVariableValue.id));

      if (directValue != null) return { ...directValue, ...baseVariableValue };
      if (referenceValue != null)
        return { ...referenceValue, ...baseVariableValue };

      log.error("Found variable value with no direct or reference value", {
        variableValueId: baseVariableValue.id,
      });
      return null;
    });
  }

  exists(id: string) {
    return this.db
      .select()
      .from(schema.deploymentVariableValue)
      .where(eq(schema.deploymentVariableValue.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
