import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
  Release,
} from "../types.js";

/**
 * A rule that filters releases based on a regex pattern applied to the version tag.
 *
 * This rule allows for filtering releases based on patterns in their version tags,
 * such as only allowing deployment of releases with semantic version patterns,
 * or filtering out certain types of versions like pre-releases.
 *
 * @example
 * ```ts
 * // Only allow releases with semantic versioning
 * new VersionRegexRule(/^v\d+\.\d+\.\d+$/);
 *
 * // Only allow stable releases (no alpha/beta/rc)
 * new VersionRegexRule(/^v\d+\.\d+\.\d+$/, { blockPreReleases: true });
 * ```
 */
export class VersionRegexRule implements DeploymentResourceRule {
  public readonly name = "VersionRegexRule";

  constructor(
    private pattern: RegExp,
    private options: {
      allowIfNoMatch?: boolean;
      blockPreReleases?: boolean;
    } = {},
  ) {}

  filter(
    _: DeploymentResourceContext,
    currentCandidates: Release[],
  ): DeploymentResourceRuleResult {
    // Apply both the regex pattern and prerelease filtering if configured
    const allowedReleases = currentCandidates.filter((release) => {
      const tag = release.version.tag;

      // Filter by regex pattern
      const patternMatches = this.pattern.test(tag);

      // Optional pre-release filtering (alpha, beta, rc, etc.)
      let isPreRelease = false;
      if (this.options.blockPreReleases) {
        isPreRelease = /-(alpha|beta|rc|dev|test)/.test(tag);
      }

      // If allowIfNoMatch is true, we want to allow versions that don't match the pattern
      if (this.options.allowIfNoMatch) {
        return !patternMatches ? true : !isPreRelease;
      }

      // Otherwise we require a match and not a pre-release if blocking those
      return patternMatches && !isPreRelease;
    });

    if (allowedReleases.length === 0) {
      return {
        allowedReleases: [],
        reason: `No releases match the required version pattern: ${this.pattern}`,
      };
    }

    return { allowedReleases };
  }
}
