import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { and, desc, eq, isNull, or, takeFirst } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";

import type { ReleaseManager, ReleaseTarget } from "./types.js";
import type { MaybeVariable, Variable } from "./variables/types.js";
import { VariableManager } from "./variables/variables.js";

const log = logger.child({
  module: "VariableReleaseManager",
});

export class VariableReleaseManager implements ReleaseManager {
  constructor(
    private readonly db: Tx = dbClient,
    private readonly releaseTarget: ReleaseTarget,
  ) {}

  private async insertRelease(tx: Tx, releaseTargetId: string) {
    return tx
      .insert(schema.variableSetRelease)
      .values({ releaseTargetId })
      .returning()
      .then(takeFirst);
  }

  private async getExistingValueSnapshots(tx: Tx, variables: Variable<any>[]) {
    const { workspaceId } = this.releaseTarget;

    const variableEqualityChecks = variables.map((v) => {
      const valueCheck =
        v.value == null
          ? isNull(schema.variableValueSnapshot.value)
          : eq(schema.variableValueSnapshot.value, v.value);
      return and(eq(schema.variableValueSnapshot.key, v.key), valueCheck);
    });

    return tx
      .select()
      .from(schema.variableValueSnapshot)
      .where(
        and(
          eq(schema.variableValueSnapshot.workspaceId, workspaceId),
          or(...variableEqualityChecks),
        ),
      );
  }

  private async insertNewValueSnapshots(tx: Tx, variables: Variable<any>[]) {
    const { workspaceId } = this.releaseTarget;
    const newSnapshotInserts = variables.map((v) => ({
      workspaceId,
      key: v.key,
      value: v.value,
      sensitive: v.sensitive,
    }));

    return tx
      .insert(schema.variableValueSnapshot)
      .values(newSnapshotInserts)
      .onConflictDoNothing()
      .returning();
  }

  private async getValueSnapshotsForRelease(
    tx: Tx,
    variables: Variable<any>[],
  ) {
    const existingSnapshots = await this.getExistingValueSnapshots(
      tx,
      variables,
    );
    const newVarsToInsert = variables.filter(
      (v) => !existingSnapshots.some((s) => s.key === v.key),
    );
    if (newVarsToInsert.length === 0) return existingSnapshots;
    const newSnapshots = await this.insertNewValueSnapshots(
      tx,
      newVarsToInsert,
    );
    return [...existingSnapshots, ...newSnapshots];
  }

  private getStringifiedValue(value: any) {
    if (value == null) return null;
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  async upsertRelease(variables: MaybeVariable[]) {
    const latestRelease = await this.findLatestRelease();

    const oldVars = _(latestRelease?.values ?? [])
      .map((v) => [
        v.variableValueSnapshot.key,
        this.getStringifiedValue(v.variableValueSnapshot.value),
      ])
      .fromPairs()
      .value();

    const newVars = _(variables)
      .compact()
      .map((v) => [v.key, this.getStringifiedValue(v.value)])
      .fromPairs()
      .value();

    const isSame = _.isEqual(oldVars, newVars);
    if (latestRelease != null && isSame)
      return { created: false, release: latestRelease };

    return this.db.transaction(async (tx) => {
      const release = await this.insertRelease(tx, this.releaseTarget.id);

      const vars = _.compact(variables);
      if (vars.length === 0) return { created: true, release };

      const valueSnapshots = await this.getValueSnapshotsForRelease(tx, vars);
      if (valueSnapshots.length === 0) {
        log.error(
          "upsert variable release had variables to insert, but no snapshots were found",
          { releaseTargetId: this.releaseTarget.id, variables },
        );
        return { created: true, release };
      }

      await tx.insert(schema.variableSetReleaseValue).values(
        valueSnapshots.map((v) => ({
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
    try {
      const variableManager = await VariableManager.database(
        this.releaseTarget,
      );
      const variables = await variableManager.getVariables();
      return { chosenCandidate: variables };
    } catch (e) {
      log.error(
        `Failed to evaluate variables for release target ${this.releaseTarget.id}, ${JSON.stringify(e)}`,
      );
      return { chosenCandidate: [] };
    }
  }
}
