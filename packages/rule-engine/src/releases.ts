import type { DeploymentResourceContext, ResolvedRelease } from "./types.js";

/**
 * A class that encapsulates candidate releases with utility methods for common
 * operations.
 *
 * This class is used throughout the rule engine to provide consistent handling
 * of release collections. Rules should operate on CandidateReleases instances
 * and return all valid candidates, not just a single one. This ensures that
 * downstream rules have the full set of options to apply their own filtering
 * logic.
 *
 * For example, if a rule determines that sequential upgrades are required, it
 * should return all releases that are valid sequential candidates, not just the
 * oldest one. This allows subsequent rules to further filter the candidates
 * based on their criteria.
 */
export class Releases {
  /**
   * The internal array of release candidates
   */
  private releases: ResolvedRelease[];

  /**
   * Creates a new CandidateReleases instance.
   *
   * @param releases - The array of releases to manage
   */
  constructor(releases: ResolvedRelease[]) {
    this.releases = [...releases];
  }

  /**
   * Static factory method to create an empty CandidateReleases instance.
   *
   * @returns A new CandidateReleases instance with no releases
   */
  static empty(): Releases {
    return new Releases([]);
  }

  /**
   * Static factory method to create a new CandidateReleases instance.
   *
   * @param releases - The array of releases to manage
   * @returns A new CandidateReleases instance
   */
  static from(releases: ResolvedRelease | ResolvedRelease[]): Releases {
    const releasesToInclude = Array.isArray(releases) ? releases : [releases];
    return new Releases(releasesToInclude);
  }

  /**
   * Returns all releases in this collection.
   *
   * @returns The array of all releases
   */
  getAll(): ResolvedRelease[] {
    return [...this.releases];
  }

  /**
   * Returns the oldest release based on creation date.
   *
   * @returns The oldest release, or undefined if the collection is empty
   */
  getOldest(): ResolvedRelease | undefined {
    if (this.releases.length === 0) return undefined;

    return this.releases.reduce(
      (oldest, current) =>
        current.createdAt < (oldest?.createdAt ?? current.createdAt)
          ? current
          : oldest,
      this.releases[0],
    );
  }

  /**
   * Returns the newest release based on creation date.
   *
   * @returns The newest release, or undefined if the collection is empty
   */
  getNewest(): ResolvedRelease | undefined {
    if (this.releases.length === 0) return undefined;

    return this.releases.reduce(
      (newest, current) =>
        current.createdAt > (newest?.createdAt ?? current.createdAt)
          ? current
          : newest,
      this.releases[0],
    );
  }

  /**
   * Returns the release that matches the desired release ID from the context.
   *
   * @param context - The deployment context containing the desired release ID
   * @returns The desired release if found, or undefined if not found or no ID
   * specified
   */
  getDesired(context: DeploymentResourceContext): ResolvedRelease | undefined {
    if (!context.desiredReleaseId) return undefined;

    return this.releases.find(
      (release) => release.id === context.desiredReleaseId,
    );
  }

  /**
   * Returns the effective target release - either the desired release if
   * specified, or the newest available release if no desired release is
   * specified.
   *
   * @param context - The deployment context containing the desired release ID
   * @returns The effective target release, or undefined if no candidates are
   * available
   */
  getEffectiveTarget(
    context: DeploymentResourceContext,
  ): ResolvedRelease | undefined {
    if (this.releases.length === 0) return undefined;
    return this.getDesired(context) ?? this.getNewest();
  }

  /**
   * Filters releases based on a metadata key and value.
   *
   * @param metadataKey - The metadata key to check
   * @param metadataValue - The expected value for the metadata key
   * @returns A new CandidateReleases instance with filtered releases
   */
  filterByMetadata(metadataKey: string, metadataValue: string): Releases {
    return this.filter(
      (release) => release.version.metadata[metadataKey] === metadataValue,
    );
  }

  /**
   * Returns a new CandidateReleases instance sorted by creation date in
   * ascending order (oldest first).
   *
   * @returns A new CandidateReleases instance with sorted releases
   */
  sortByCreationDateAsc(): Releases {
    const sorted = [...this.releases].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    return new Releases(sorted);
  }

  /**
   * Returns a new CandidateReleases instance sorted by creation date in
   * descending order (newest first).
   *
   * @returns A new CandidateReleases instance with sorted releases
   */
  sortByCreationDateDesc(): Releases {
    const sorted = [...this.releases].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    return new Releases(sorted);
  }

  /**
   * Returns a new CandidateReleases instance with releases created before the
   * reference release.
   *
   * @param referenceRelease - The reference release to compare against
   * @returns A new CandidateReleases instance with filtered releases
   */
  getCreatedBefore(referenceRelease: ResolvedRelease): Releases {
    const filtered = this.releases.filter(
      (release) => release.createdAt < referenceRelease.createdAt,
    );
    return new Releases(filtered);
  }

  /**
   * Returns a new CandidateReleases instance with releases created after the
   * reference release.
   *
   * @param referenceRelease - The reference release to compare against
   * @returns A new CandidateReleases instance with filtered releases
   */
  getCreatedAfter(referenceRelease: ResolvedRelease): Releases {
    const filtered = this.releases.filter(
      (release) => release.createdAt > referenceRelease.createdAt,
    );
    return new Releases(filtered);
  }

  /**
   * Finds a release by ID.
   *
   * @param id - The release ID to search for
   * @returns The matching release or undefined if not found
   */
  findById(id: string): ResolvedRelease | undefined {
    return this.releases.find((release) => release.id === id);
  }

  /**
   * Returns the number of releases in this collection.
   *
   * @returns The number of releases
   */
  get length(): number {
    return this.releases.length;
  }

  /**
   * Checks if the collection is empty.
   *
   * @returns True if there are no releases, false otherwise
   */
  isEmpty(): boolean {
    return this.releases.length === 0;
  }

  /**
   * Creates a new CandidateReleases instance with the given releases added.
   *
   * @param releases - Releases to add to the collection
   * @returns A new CandidateReleases instance
   */
  add(releases: ResolvedRelease | ResolvedRelease[]): Releases {
    const releasesToAdd = Array.isArray(releases) ? releases : [releases];
    return new Releases([...this.releases, ...releasesToAdd]);
  }

  /**
   * Maps the releases using a mapping function.
   *
   * @param mapper - Function to transform each release
   * @returns A new array with the mapped values
   */
  map<T>(mapper: (release: ResolvedRelease) => T): T[] {
    return this.releases.map(mapper);
  }

  /**
   * Iterates over all releases in the collection.
   *
   * @param callback - Function to call for each release
   */
  forEach(callback: (release: ResolvedRelease) => void): void {
    this.releases.forEach(callback);
  }

  /**
   * Filters the releases using a predicate function.
   *
   * @param predicate - Function that determines whether to include a release
   * @returns A new CandidateReleases instance with filtered releases
   */
  filter(predicate: (release: ResolvedRelease) => boolean): Releases {
    const filtered = this.releases.filter(predicate);
    return new Releases(filtered);
  }

  /**
   * Finds a release that satisfies the provided predicate.
   *
   * @param predicate - Function to test each release
   * @returns The first release that satisfies the predicate, or undefined if
   * none is found
   */
  find(
    predicate: (release: ResolvedRelease) => boolean,
  ): ResolvedRelease | undefined {
    return this.releases.find(predicate);
  }

  /**
   * Checks if any release in the collection satisfies the predicate.
   *
   * @param predicate - Function to test each release
   * @returns True if at least one release satisfies the predicate, false
   * otherwise
   */
  some(predicate: (release: ResolvedRelease) => boolean): boolean {
    return this.releases.some(predicate);
  }

  /**
   * Checks if all releases in the collection satisfy the predicate.
   *
   * @param predicate - Function to test each release
   * @returns True if all releases satisfy the predicate, false otherwise
   */
  every(predicate: (release: ResolvedRelease) => boolean): boolean {
    return this.releases.every(predicate);
  }

  /**
   * Returns the release at the specified index.
   *
   * @param index - The index of the release to return
   * @returns The release at the specified index, or undefined if the index is out of bounds
   */
  at(index: number): ResolvedRelease | undefined {
    return this.releases[index];
  }
}
