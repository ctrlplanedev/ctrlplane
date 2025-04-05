import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { eq, takeFirst } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Policy, ReleaseTargetIdentifier } from "../../types.js";
import type { MaybeVariable } from "../variables/types.js";
import type { Release, ReleaseRepository, ReleaseWithId } from "./types.js";
import type {
  Release,
  ReleaseRepository,
  ReleaseWithId,
  ReleaseWithVersionAndVariables,
} from "./types.js";
import { getApplicablePolicies } from "../../db/get-applicable-policies.js";
import { mergePolicies } from "../../utils/merge-policies.js";
import { VariableManager } from "../variables/variables.js";
import {
  findLatestPolicyMatchingRelease,
  findPolicyMatchingReleasesBetweenDeployments,
} from "./get-releases.js";

type ReleaseTarget = {
  id: string;
  deploymentId: string;
  environmentId: string;
  resourceId: string;
  workspaceId: string;
};

/**
 * Repository implementation that combines database operations with business logic
 * for managing releases. Handles creating, updating and querying releases while
 * enforcing policy constraints.
 */
export class DatabaseReleaseRepository implements ReleaseRepository {
  /**
   * Creates a new DatabaseReleaseRepository instance
   * @param releaseTarget - The release target to manage releases for
   * @returns A configured DatabaseReleaseRepository instance
   */
  static async create(releaseTarget: ReleaseTarget) {
    const variableManager = await VariableManager.database(releaseTarget);
    return new DatabaseReleaseRepository(
      dbClient,
      releaseTarget,
      variableManager,
    );
  }

  private constructor(
    private readonly db: Tx = dbClient,
    private readonly releaseTarget: ReleaseTarget,
    private readonly variableManager: VariableManager,
  ) {}

  /**
   * Gets the latest variables for this release target
   * @returns The current variables
   */
  async getLatestVariables() {
    return this.variableManager.getVariables();
  }

  /**
   * Gets the merged policy that applies to this release target
   * @returns The applicable policy, or null if none exist
   */
  async getPolicy(): Promise<Policy | null> {
    const policies = await getApplicablePolicies(
      this.db,
      this.releaseTarget.workspaceId,
      this.releaseTarget,
    );
    return mergePolicies(policies);
  }

  /**
   * Gets all releases that match the current policy constraints
   * @returns Array of matching releases
   */
  async getApplicableReleases(
    policy: Policy | null,
  ): Promise<ReleaseWithVersionAndVariables[]> {
    return findPolicyMatchingReleasesBetweenDeployments(
      this.db,
      this.releaseTarget.id,
      policy,
    );
  }

  /**
   * Gets the most recent release that matches policy constraints
   * @returns The newest matching release, or null if none exist
   */
  async getNewestRelease(): Promise<ReleaseWithVersionAndVariables | null> {
    const policy = await this.getPolicy();
    return (
      (await findLatestPolicyMatchingRelease(
        this.db,
        policy,
        this.releaseTarget,
      )) ?? null
    );
  }

  /**
   * Creates a new release within a transaction
   * @param release - The release to create
   * @param tx - The transaction to use
   * @returns The created release with ID
   */
  private async createReleaseInTransaction(
    release: Omit<Release, "id" | "createdAt">,
    tx: Tx,
  ) {
    const dbRelease = await tx
      .insert(schema.release)
      .values({ ...release, releaseTargetId: this.releaseTarget.id })
      .returning()
      .then(takeFirst);

    await tx.insert(schema.releaseVariable).values(
      release.variables.map((v) => ({
        releaseId: dbRelease.id,
        key: v.key,
        value: v.value,
        sensitive: v.sensitive,
      })),
    );

    return { ...release, ...dbRelease };
  }

  /**
   * Creates a new release
   * @param release - The release to create
   * @returns The created release with ID
   */
  async create(release: Omit<Release, "id" | "createdAt">) {
    return this.db.transaction((tx) =>
      this.createReleaseInTransaction(release, tx),
    );
  }

  /**
   * Creates a new release only if one doesn't already exist with the same version and variables
   * @param options - The release target identifier
   * @param versionId - The version ID for the release
   * @param variables - The variables for the release
   * @returns Object indicating if a new release was created and the final release
   */
  async upsert(
    options: ReleaseTargetIdentifier,
    versionId: string,
    variables: MaybeVariable[],
  ): Promise<{ created: boolean; release: ReleaseWithId }> {
    const latestRelease = await this.getNewestRelease();

    const latestR = {
      versionId: latestRelease?.versionId,
      variables: _(latestRelease?.variables ?? [])
        .map((v) => [v.key, v.value])
        .fromPairs()
        .value(),
    };

    const newR = {
      versionId,
      variables: _(variables)
        .compact()
        .map((v) => [v.key, v.value])
        .fromPairs()
        .value(),
    };

    const isSame = latestRelease != null && _.isEqual(latestR, newR);
    return isSame
      ? { created: false, release: latestRelease }
      : {
          created: true,
          release: await this.create({
            ...options,
            versionId,
            releaseTargetId: this.releaseTarget.id,
            variables: _.compact(variables),
          }),
        };
  }

  /**
   * Sets the desired release for this release target
   * @param options - The release target identifier and desired release ID
   */
  async setDesired(desiredReleaseId: string) {
    await this.db
      .update(schema.releaseTarget)
      .set({ desiredReleaseId })
      .where(eq(schema.releaseTarget.id, this.releaseTarget.id));
  }
}
