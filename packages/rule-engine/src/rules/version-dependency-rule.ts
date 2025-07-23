import type * as schema from "@ctrlplane/db/schema";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import type { Version } from "../manager/version-rule-engine";
import type { FilterRule, RuleEngineRuleResult } from "../types";

export type VersionDependencyRuleOptions = {
  getVersionDependencies: (
    versionId: string,
  ) => Promise<schema.VersionDependency[]>;
  isVersionDependencySatisfied: (
    dependency: schema.VersionDependency,
  ) => Promise<boolean>;
};

type DependencyResult = {
  dependency: schema.VersionDependency;
  isSatisfied: boolean;
};

export class VersionDependencyRule implements FilterRule<Version> {
  public readonly name = "VersionDependencyRule";

  constructor(private readonly options: VersionDependencyRuleOptions) {}

  async filter(candidates: Version[]): Promise<
    RuleEngineRuleResult<Version> & {
      dependencyResults: Record<string, DependencyResult[]>;
    }
  > {
    const rejectionReasons = new Map<string, string>();
    const dependencyResults: Record<string, DependencyResult[]> = {};

    const allowedCandidates = await Promise.all(
      candidates.map(async (candidate) => {
        const dependencies = await this.options.getVersionDependencies(
          candidate.id,
        );

        const candidateResultsPromises = dependencies.map(
          async (dependency) => {
            const isSatisfied =
              await this.options.isVersionDependencySatisfied(dependency);

            return { dependency, isSatisfied };
          },
        );
        const candidateResults = await Promise.all(candidateResultsPromises);
        dependencyResults[candidate.id] = candidateResults;

        const hasFailedDependency = candidateResults.some(
          (result) => !result.isSatisfied,
        );

        if (hasFailedDependency) {
          rejectionReasons.set(candidate.id, "Dependencies not satisfied");
          return null;
        }

        return candidate;
      }),
    ).then((results) => results.filter(isPresent));

    return {
      allowedCandidates,
      rejectionReasons,
      dependencyResults,
    };
  }
}
