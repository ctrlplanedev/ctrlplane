import {
  and,
  eq,
  inArray,
  isNotNull,
  isNull,
} from "drizzle-orm/pg-core/expressions";

import { logger } from "@ctrlplane/logger";

import type { Tx } from "../../common.js";
import * as SCHEMA from "../../schema/index.js";
import { QueryBuilder } from "../query/builder.js";
import { createAndAcquireMutex, SelectorComputeType } from "./mutex.js";

const log = logger.child({ module: "environment-builder" });

export class EnvironmentBuilder {
  constructor(
    private readonly tx: Tx,
    private readonly environments: SCHEMA.Environment[],
  ) {}

  private deleteExistingComputedResources(tx: Tx) {
    return tx
      .delete(SCHEMA.computedEnvironmentResource)
      .where(
        inArray(
          SCHEMA.computedEnvironmentResource.environmentId,
          this.environmentIds,
        ),
      );
  }

  private get environmentIds() {
    return this.environments.map((e) => e.id);
  }

  private async getEnvironments(tx: Tx) {
    return tx.query.environment.findMany({
      where: and(
        inArray(SCHEMA.environment.id, this.environmentIds),
        isNotNull(SCHEMA.environment.resourceSelector),
      ),
      with: { system: true },
    });
  }

  private async findMatchingResourcesForEnvironments(tx: Tx) {
    const envs = await this.getEnvironments(tx);

    const promises = envs.map(async (env) => {
      const environmentId = env.id;
      const { system } = env;
      const { workspaceId } = system;
      if (env.resourceSelector == null) return [];
      const qb = new QueryBuilder(tx);
      const resources = await tx.query.resource.findMany({
        where: and(
          eq(SCHEMA.resource.workspaceId, workspaceId),
          qb.resources().where(env.resourceSelector).sql(),
          isNull(SCHEMA.resource.deletedAt),
        ),
      });
      return resources.map((r) => ({ environmentId, resourceId: r.id }));
    });

    const fulfilled = await Promise.all(promises);
    return fulfilled.flat();
  }

  async resourceSelectors() {
    const environments = await this.getEnvironments(this.tx);
    const workspaceIds = new Set(environments.map((e) => e.system.workspaceId));
    if (workspaceIds.size !== 1)
      throw new Error("All environments must be in the same workspace");
    const workspaceId = Array.from(workspaceIds)[0]!;

    const mutex = await createAndAcquireMutex(
      SelectorComputeType.EnvironmentBuilder,
      workspaceId,
    );

    try {
      return this.tx.transaction(async (tx) => {
        await this.deleteExistingComputedResources(tx);
        const vals = await this.findMatchingResourcesForEnvironments(tx);

        if (vals.length === 0) return [];

        const results = await tx
          .insert(SCHEMA.computedEnvironmentResource)
          .values(vals)
          .onConflictDoNothing()
          .returning();

        return results;
      });
    } catch (e) {
      log.error("Error computing resource selectors", {
        error: e,
        workspaceId,
      });
      throw e;
    } finally {
      await mutex.unlock();
    }
  }
}

export class WorkspaceEnvironmentBuilder {
  constructor(
    private readonly tx: Tx,
    private readonly workspaceId: string,
  ) {}

  private async getEnvironmentsWithSelectors(tx: Tx) {
    return tx
      .select({ environment: SCHEMA.environment })
      .from(SCHEMA.environment)
      .innerJoin(
        SCHEMA.system,
        eq(SCHEMA.environment.systemId, SCHEMA.system.id),
      )
      .where(
        and(
          eq(SCHEMA.system.workspaceId, this.workspaceId),
          isNotNull(SCHEMA.environment.resourceSelector),
        ),
      )
      .then((m) => m.map((e) => e.environment));
  }

  private async deleteExistingComputedResources(tx: Tx) {
    const envs = await this.getEnvironmentsWithSelectors(tx);
    await tx.delete(SCHEMA.computedEnvironmentResource).where(
      inArray(
        SCHEMA.computedEnvironmentResource.environmentId,
        envs.map((e) => e.id),
      ),
    );
  }

  private async findMatchingResourcesForEnvironments(tx: Tx) {
    const envs = await this.getEnvironmentsWithSelectors(tx);
    const promises = envs.map(async (env) => {
      if (env.resourceSelector == null) return [];
      const qb = new QueryBuilder(tx);
      const resources = await tx.query.resource.findMany({
        where: and(
          eq(SCHEMA.resource.workspaceId, this.workspaceId),
          qb.resources().where(env.resourceSelector).sql(),
          isNull(SCHEMA.resource.deletedAt),
        ),
      });

      return resources.map((r) => ({
        environmentId: env.id,
        resourceId: r.id,
      }));
    });

    const fulfilled = await Promise.all(promises);
    return fulfilled.flat();
  }

  async resourceSelectors() {
    const mutex = await createAndAcquireMutex(
      SelectorComputeType.EnvironmentBuilder,
      this.workspaceId,
    );

    try {
      return this.tx.transaction(async (tx) => {
        await this.deleteExistingComputedResources(tx);
        const vals = await this.findMatchingResourcesForEnvironments(tx);

        if (vals.length === 0) return [];

        const results = await tx
          .insert(SCHEMA.computedEnvironmentResource)
          .values(vals)
          .onConflictDoNothing()
          .returning();

        return results;
      });
    } catch (e) {
      log.error("Error computing resource selectors", {
        error: e,
        workspaceId: this.workspaceId,
      });
      throw e;
    } finally {
      await mutex.unlock();
    }
  }
}
