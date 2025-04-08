import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { desc, eq, takeFirst } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Policy } from "../types.js";
import type { ReleaseManager, ReleaseTarget } from "./types.js";
import type { MaybeVariable } from "./variables/types.js";
import { VariableManager } from "./variables/variables.js";

export class VariableReleaseManager implements ReleaseManager {
  private cachedPolicy: Policy | null = null;

  constructor(
    private readonly db: Tx = dbClient,
    private readonly releaseTarget: ReleaseTarget,
  ) {}

  async upsertRelease(variables: MaybeVariable[]) {
    const latestRelease = await this.findLatestRelease();

    const oldVars = _(latestRelease?.values ?? [])
      .map((v) => [v.variableValueSnapshot.key, v.variableValueSnapshot.value])
      .fromPairs()
      .value();

    const newVars = _(variables)
      .compact()
      .map((v) => [v.key, v.value])
      .fromPairs()
      .value();

    const isSame = _.isEqual(oldVars, newVars);
    if (latestRelease != null && isSame)
      return { created: false, release: latestRelease };

    return this.db.transaction(async (tx) => {
      const release = await tx
        .insert(schema.variableSetRelease)
        .values({ releaseTargetId: this.releaseTarget.id })
        .returning()
        .then(takeFirst);

      const vars = _.compact(variables);
      if (vars.length === 0) return { created: true, release };

      const variableValueSnapshot = await tx
        .insert(schema.variableValueSnapshot)
        .values(
          vars.map((v) => ({
            workspaceId: this.releaseTarget.workspaceId,
            key: v.key,
            value: v.value,
            sensitive: v.sensitive,
          })),
        )
        .onConflictDoNothing()
        .returning();

      await tx.insert(schema.variableSetReleaseValue).values(
        variableValueSnapshot.map((v) => ({
          variableSetReleaseId: release.id,
          variableValueSnapshotId: v.id,
        })),
      );

      return { created: true, release };
    });
  }

  async findLatestRelease() {
    return this.db.query.variableSetRelease.findFirst({
      where: eq(
        schema.variableSetRelease.releaseTargetId,
        this.releaseTarget.id,
      ),
      orderBy: desc(schema.variableSetRelease.createdAt),
      with: { values: { with: { variableValueSnapshot: true } } },
    });
  }

  async evaluate() {
    const variableManager = await VariableManager.database(this.releaseTarget);
    const variables = await variableManager.getVariables();
    return { chosenCandidate: variables };
  }
}
