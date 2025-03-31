import type { Tx } from "@ctrlplane/db";

import { and, desc, eq } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";

import type { DeploymentResourceContext } from "..";

type Policy = SCHEMA.Policy & {
  denyWindows: SCHEMA.PolicyRuleDenyWindow[];
  deploymentVersionSelector: SCHEMA.PolicyDeploymentVersionSelector | null;
};

export const getReleases = async (
  db: Tx,
  ctx: DeploymentResourceContext,
  policy: Policy,
) =>
  db.query.release
    .findMany({
      where: and(
        eq(SCHEMA.release.deploymentId, ctx.deployment.id),
        eq(SCHEMA.release.resourceId, ctx.resource.id),
        eq(SCHEMA.release.environmentId, ctx.environment.id),
        SCHEMA.deploymentVersionMatchesCondition(
          db,
          policy.deploymentVersionSelector?.deploymentVersionSelector,
        ),
      ),
      with: {
        version: { with: { metadata: true } },
        variables: true,
      },
      orderBy: desc(SCHEMA.release.createdAt),
    })
    .then((releases) =>
      releases.map((release) => ({
        ...release,
        variables: Object.fromEntries(
          release.variables.map((v) => [v.key, v.value]),
        ),
        version: {
          ...release.version,
          metadata: Object.fromEntries(
            release.version.metadata.map((m) => [m.key, m.value]),
          ),
        },
      })),
    );
