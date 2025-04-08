import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { desc, eq, takeFirst } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { MaybeVariable } from "../repositories/index.js";
import type { ReleaseTarget } from "./types.js";

export class VariableReleaseManager {
  private constructor(
    private readonly db: Tx = dbClient,
    private readonly releaseTarget: ReleaseTarget,
  ) {}

  async upsertRelease(variables: MaybeVariable[]) {
    const latestRelease = await this.findLatestRelease();

    const oldVars = _(latestRelease?.values ?? [])
      .map((v) => [v.key, v.value])
      .fromPairs()
      .value();

    const newVars = _(variables)
      .compact()
      .map((v) => [v.key, v.value])
      .fromPairs()
      .value();

    const isSame = _.isEqual(oldVars, newVars);
    if (isSame) return { created: false, latestRelease };

    return this.db.transaction(async (tx) => {
      const release = await tx
        .insert(schema.variableRelease)
        .values({ releaseTargetId: this.releaseTarget.id })
        .returning()
        .then(takeFirst);

      const vars = _.compact(variables);
      await tx.insert(schema.variableReleaseValue).values(
        vars.map((v) => ({
          variableReleaseId: release.id,
          key: v.key,
          value: v.value,
        })),
      );

      return { created: true, release };
    });
  }

  async findLatestRelease() {
    return this.db.query.variableRelease.findFirst({
      where: eq(schema.variableRelease.releaseTargetId, this.releaseTarget.id),
      orderBy: desc(schema.variableRelease.createdAt),
      with: { values: true },
    });
  }
}
