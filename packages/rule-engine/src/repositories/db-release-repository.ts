import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { eq, takeFirst } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { DeploymentResourceContext, Policy } from "../types.js";
import type {
  CompleteRelease,
  Release,
  ReleaseRepository,
  ReleaseWithId,
} from "./types.js";
import type { MaybeVariable } from "./variables/types.js";
import { getApplicablePolicies } from "../db/get-applicable-policies.js";
import { mergePolicies } from "../utils/merge-policies.js";
import {
  findLatestPolicyMatchingRelease,
  findPolicyMatchingReleasesBetweenDeployments,
} from "./get-releases.js";
import { VariableManager } from "./variables/variables.js";

/**
 * Release target with associated identifiers
 */
interface ReleaseTarget {
  id: string;
  deploymentId: string;
  environmentId: string;
  resourceId: string;
  workspaceId: string;
}

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

  // Cache for the calculated policy
  private cachedPolicy: Policy | null = null;

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
   * Uses a cached value if available
   * @param forceRefresh - Whether to force a refresh of the policy from DB
   * @returns The applicable policy, or null if none exist
   */
  async getPolicy(forceRefresh = false): Promise<Policy | null> {
    // Return cached policy if available and refresh not forced
    if (!forceRefresh && this.cachedPolicy !== null) {
      return this.cachedPolicy;
    }

    const policies = await getApplicablePolicies(
      this.db,
      this.releaseTarget.workspaceId,
      this.releaseTarget,
    );

    this.cachedPolicy = mergePolicies(policies);
    return this.cachedPolicy;
  }

  /**
   * Retrieves all releases that match the given policy
   * @param policy - Optional policy to use; if not provided, will use cached or fetched policy
   * @returns Promise resolving to array of matching releases
   */
  async findMatchingReleases(): Promise<CompleteRelease[]> {
    const policy = await this.getPolicy();
    return findPolicyMatchingReleasesBetweenDeployments(
      this.db,
      this.releaseTarget.id,
      policy,
    );
  }

  /**
   * Gets the most recent release matching policy constraints
   * @param policy - Optional policy to use; if not provided, will use cached or fetched policy
   * @returns Promise resolving to the latest matching release or null
   */
  async findLatestRelease(): Promise<CompleteRelease | null> {
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
  ): Promise<ReleaseWithId> {
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
  async createRelease(
    release: Omit<Release, "id" | "createdAt">,
  ): Promise<ReleaseWithId> {
    return this.db.transaction((tx) =>
      this.createReleaseInTransaction(release, tx),
    );
  }

  /**
   * Creates a new release only if one doesn't already exist with the same version and variables

   * @param versionId - The version ID for the release
   * @param variables - The variables for the release
   * @returns Object indicating if a new release was created and the final release
   */
  async upsertRelease(
    versionId: string,
    variables: MaybeVariable[],
  ): Promise<{ created: boolean; release: ReleaseWithId }> {
    const latestRelease = await this.findLatestRelease();

    const latestReleaseInfo = {
      versionId: latestRelease?.versionId,
      variables: _(latestRelease?.variables ?? [])
        .map((v) => [v.key, v.value])
        .fromPairs()
        .value(),
    };

    const newReleaseInfo = {
      versionId,
      variables: _(variables)
        .compact()
        .map((v) => [v.key, v.value])
        .fromPairs()
        .value(),
    };

    const isSame =
      latestRelease != null && _.isEqual(latestReleaseInfo, newReleaseInfo);
    return isSame
      ? { created: false, release: latestRelease }
      : {
          created: true,
          release: await this.createRelease({
            versionId,
            releaseTargetId: this.releaseTarget.id,
            variables: _.compact(variables),
          }),
        };
  }

  async upsertReleaseWithVariables(
    variables: MaybeVariable[],
  ): Promise<{ created: boolean; release: ReleaseWithId } | null> {
    const latestRelease = await this.findLatestRelease();
    const versionId = latestRelease?.versionId ?? null;
    return versionId == null ? null : this.upsertRelease(versionId, variables);
  }

  async upsertReleaseWithVersionId(
    versionId: string,
  ): Promise<{ created: boolean; release: ReleaseWithId }> {
    const latestRelease = await this.findLatestRelease();
    return this.upsertRelease(versionId, latestRelease?.variables ?? []);
  }

  /**
   * Sets the desired release for the target
   * @param desiredReleaseId - ID of the release to set as desired
   */
  async setDesiredRelease(desiredReleaseId: string | null): Promise<void> {
    await this.db
      .update(schema.releaseTarget)
      .set({ desiredReleaseId })
      .where(eq(schema.releaseTarget.id, this.releaseTarget.id));
  }

  async getCtx(): Promise<DeploymentResourceContext | undefined> {
    return this.db.query.releaseTarget.findFirst({
      where: eq(schema.releaseTarget.id, this.releaseTarget.id),
      with: {
        resource: true,
        environment: true,
        deployment: true,
      },
    });
  }
}
