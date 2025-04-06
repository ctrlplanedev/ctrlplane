import { and, inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Releases } from "../releases.js";
import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
  Policy,
} from "../types.js";

const REJECTION_REASON = "Version not in version selector";

type GetApplicableVersionIdsFunc = (
  context: DeploymentResourceContext,
  versionIds: string[],
) => Promise<string[]> | string[];

export class DeploymentVersionSelectorRule implements DeploymentResourceRule {
  public readonly name = "DeploymentVersionSelectorRule";

  constructor(private getApplicableVersionIds: GetApplicableVersionIdsFunc) {}

  async filter(
    context: DeploymentResourceContext,
    releases: Releases,
  ): Promise<DeploymentResourceRuleResult> {
    const applicableVersionIds = await this.getApplicableVersionIds(
      context,
      releases.map((r) => r.version.id),
    );

    const rejectionReasons = new Map<string, string>();
    return {
      allowedReleases: releases.filter((r) => {
        const versionId = r.version.id;
        if (!applicableVersionIds.includes(versionId)) {
          rejectionReasons.set(versionId, REJECTION_REASON);
          return false;
        }
        return true;
      }),
      rejectionReasons,
    };
  }
}

export const getApplicableVersionIds =
  (selector: Policy["deploymentVersionSelector"]) =>
  (_: DeploymentResourceContext, versionIds: string[]) => {
    if (selector == null) return versionIds;
    return db
      .select({ id: schema.deploymentVersion.id })
      .from(schema.deploymentVersion)
      .where(
        and(
          schema.deploymentVersionMatchesCondition(
            db,
            selector.deploymentVersionSelector,
          ),
          inArray(schema.deploymentVersion.id, versionIds),
        ),
      )
      .then((rows) => rows.map((r) => r.id));
  };
