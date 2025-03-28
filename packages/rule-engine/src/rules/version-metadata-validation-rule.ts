import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
} from "../types.js";
import { Releases } from "../releases.js";

/**
 * Options for configuring the MetadataValidationRule
 */
export type MetadataValidationRuleOptions = {
  /**
   * The metadata key to validate
   */
  metadataKey: string;

  /**
   * The value that the metadata key must match for a release to be allowed
   */
  requiredValue: string;

  /**
   * Whether to also allow releases that don't have the specified metadata key
   * Default: false
   */
  allowMissingMetadata?: boolean;

  /**
   * Whether to validate for environment-specific values
   * If true, will first check for "{metadataKey}.{environmentName}" before falling back to metadataKey
   * Default: false
   */
  checkEnvironmentSpecificValues?: boolean;

  /**
   * A custom error message to use when a release is blocked
   * If not provided, a default message will be generated
   * The message can include {key} and {value} placeholders that will be replaced
   */
  customErrorMessage?: string;

  /**
   * Only apply this rule to specific environments
   * If provided, the rule will only be applied if the environment name matches one of these patterns
   */
  environmentPatterns?: string[];
};

/**
 * A rule that validates metadata properties on releases, allowing only releases
 * that have a specific metadata key set to a required value.
 *
 * This rule is useful for enforcing that releases have passed specific validation steps,
 * have been approved by specific teams, or meet other criteria tracked in metadata.
 *
 * @example
 * ```ts
 * // Basic usage: only allow releases with "securityApproved" set to "true"
 * new MetadataValidationRule({
 *   metadataKey: "securityApproved",
 *   requiredValue: "true"
 * });
 *
 * // Allow releases with "qaStatus" set to "passed" or missing the field entirely
 * new MetadataValidationRule({
 *   metadataKey: "qaStatus",
 *   requiredValue: "passed",
 *   allowMissingMetadata: true
 * });
 *
 * // Check environment-specific values first
 * // For production environment, will check "complianceApproved.production" first,
 * // then fall back to "complianceApproved" if the specific key isn't found
 * new MetadataValidationRule({
 *   metadataKey: "complianceApproved",
 *   requiredValue: "true",
 *   checkEnvironmentSpecificValues: true
 * });
 *
 * // Only apply in production environments
 * new MetadataValidationRule({
 *   metadataKey: "securityApproved",
 *   requiredValue: "true",
 *   environmentPatterns: ["prod", "production"]
 * });
 * ```
 */
export class VersionMetadataValidationRule implements DeploymentResourceRule {
  public readonly name = "VersionMetadataValidationRule";

  constructor(private options: MetadataValidationRuleOptions) {
    this.options.allowMissingMetadata = options.allowMissingMetadata ?? false;
    this.options.checkEnvironmentSpecificValues =
      options.checkEnvironmentSpecificValues ?? false;
  }

  filter(
    context: DeploymentResourceContext,
    releases: Releases,
  ): DeploymentResourceRuleResult {
    // Skip if no releases
    if (releases.isEmpty()) {
      return { allowedReleases: Releases.empty() };
    }

    const {
      metadataKey,
      requiredValue,
      allowMissingMetadata,
      checkEnvironmentSpecificValues,
      customErrorMessage,
      environmentPatterns,
    } = this.options;

    // If environment patterns are specified, check if we should apply this rule
    if (environmentPatterns && environmentPatterns.length > 0) {
      const envName = context.environment.name.toLowerCase();
      const shouldApply = environmentPatterns.some((pattern) =>
        envName.includes(pattern.toLowerCase()),
      );

      if (!shouldApply) {
        return { allowedReleases: releases };
      }
    }

    const allowedReleases: Releases = releases.filter((release) => {
      // If we're checking environment-specific values, try that first
      if (checkEnvironmentSpecificValues) {
        const envSpecificKey = `${metadataKey}.${context.environment.name.toLowerCase()}`;
        const envSpecificValue = release.version.metadata[envSpecificKey];

        if (envSpecificValue !== undefined) {
          // If an environment-specific value exists, use it
          return envSpecificValue === requiredValue;
        }
      }

      const metadataValue = release.version.metadata[metadataKey];
      return metadataValue == null
        ? (allowMissingMetadata ?? false)
        : metadataValue === requiredValue;
    });

    if (allowedReleases.isEmpty() && !releases.isEmpty()) {
      let reason: string;

      if (customErrorMessage) {
        reason = customErrorMessage
          .replace("{key}", metadataKey)
          .replace("{value}", requiredValue);
      } else {
        reason = `Release requires metadata property "${metadataKey}" to have value "${requiredValue}"`;
      }

      return {
        allowedReleases: Releases.empty(),
        reason,
      };
    }

    return { allowedReleases };
  }
}
