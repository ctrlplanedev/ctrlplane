import type { Tx } from "@ctrlplane/db";

import { and, eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import type { ReleaseTargetIdentifier } from "../types";
import { DatabaseReleaseRepository } from "../repositories/db-release-repository.js";

const getDesiredVersionId = async (
  db: Tx,
  repo: DatabaseReleaseRepository,
  versionId?: string,
) => {
  if (versionId != null) return versionId;
  const { desiredReleaseId } = (await repo.getCtx()) ?? {};
  if (desiredReleaseId != null) {
    const release = await db.query.release.findFirst({
      where: eq(schema.release.id, desiredReleaseId),
    });
    if (release == null)
      throw new Error(
        "Desired release not found though specified in release target",
      );
    return release.versionId;
  }
  const latestRelease = await repo.findLatestRelease();
  return latestRelease?.versionId ?? null;
};

export const createRelease = async (
  db: Tx,
  releaseTarget: ReleaseTargetIdentifier,
  workspaceId: string,
  versionId?: string,
) => {
  const rt = await db.query.releaseTarget.findFirst({
    where: and(
      eq(schema.releaseTarget.deploymentId, releaseTarget.deploymentId),
      eq(schema.releaseTarget.environmentId, releaseTarget.environmentId),
      eq(schema.releaseTarget.resourceId, releaseTarget.resourceId),
    ),
  });

  if (rt == null) throw new Error("Release target not found");

  const repo = await DatabaseReleaseRepository.create({ ...rt, workspaceId });
  const desiredVersionId = await getDesiredVersionId(db, repo, versionId);
  if (desiredVersionId == null)
    throw new Error("Could not find desired version");
  const variables = await repo.getLatestVariables();
  const identifier = {
    resourceId: releaseTarget.resourceId,
    environmentId: releaseTarget.environmentId,
    deploymentId: releaseTarget.deploymentId,
  };
  const { release, created } = await repo.upsert(
    identifier,
    desiredVersionId,
    variables,
  );

  if (!created) return;

  const allPolicyMatchingReleases = await repo.findAllPolicyMatchingReleases();
  const allValidIds = allPolicyMatchingReleases.map((r) => r.id);

  const isReleaseValid = allValidIds.includes(release.id);
  if (isReleaseValid) repo.setDesiredRelease(release.id);
};
