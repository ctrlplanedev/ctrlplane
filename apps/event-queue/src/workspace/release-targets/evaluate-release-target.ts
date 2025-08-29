import { desc, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { createReleaseJob } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import {
  VariableReleaseManager,
  VersionReleaseManager,
} from "@ctrlplane/rule-engine";

const getWorkspaceId = (releaseTarget: schema.ReleaseTarget) => {
  return db
    .select()
    .from(schema.resource)
    .where(eq(schema.resource.id, releaseTarget.resourceId))
    .then(takeFirst)
    .then((resource) => resource.workspaceId);
};

const handleVersionRelease = async (
  releaseTarget: schema.ReleaseTarget,
  workspaceId: string,
) => {
  const vrm = new VersionReleaseManager(db, { ...releaseTarget, workspaceId });
  const { chosenCandidate } = await vrm.evaluate();
  if (!chosenCandidate) return null;
  const { release: versionRelease } = await vrm.upsertRelease(
    chosenCandidate.id,
  );
  return versionRelease;
};

const handleVariableRelease = async (
  releaseTarget: schema.ReleaseTarget,
  workspaceId: string,
) => {
  const varrm = new VariableReleaseManager(db, {
    ...releaseTarget,
    workspaceId,
  });
  const { chosenCandidate: variableValues } = await varrm.evaluate();
  const { release: variableRelease } =
    await varrm.upsertRelease(variableValues);
  return variableRelease;
};

const getCurrentRelease = async (releaseTargetId: string) => {
  const currentRelease = await db
    .select()
    .from(schema.release)
    .innerJoin(
      schema.versionRelease,
      eq(schema.release.versionReleaseId, schema.versionRelease.id),
    )
    .innerJoin(
      schema.variableSetRelease,
      eq(schema.release.variableReleaseId, schema.variableSetRelease.id),
    )
    .where(eq(schema.versionRelease.releaseTargetId, releaseTargetId))
    .orderBy(desc(schema.release.createdAt))
    .limit(1)
    .then(takeFirstOrNull);

  if (currentRelease == null) return null;

  return {
    ...currentRelease.release,
    currentVersionRelease: currentRelease.version_release,
    currentVariableRelease: currentRelease.variable_set_release,
  };
};

const getHasAnythingChanged = (
  currentRelease: {
    currentVersionRelease: { id: string };
    currentVariableRelease: { id: string };
  },
  newRelease: { versionReleaseId: string; variableReleaseId: string },
) => {
  const isVersionUnchanged =
    currentRelease.currentVersionRelease.id === newRelease.versionReleaseId;
  const areVariablesUnchanged =
    currentRelease.currentVariableRelease.id === newRelease.variableReleaseId;
  return !isVersionUnchanged || !areVariablesUnchanged;
};

const insertNewRelease = async (
  versionReleaseId: string,
  variableReleaseId: string,
) =>
  db
    .insert(schema.release)
    .values({ versionReleaseId, variableReleaseId })
    .returning()
    .then(takeFirst);

const dispatchReleaseJob = async (
  release: typeof schema.release.$inferSelect,
) => {
  const existingReleaseJob = await db
    .select()
    .from(schema.releaseJob)
    .where(eq(schema.releaseJob.releaseId, release.id))
    .then(takeFirstOrNull);

  if (existingReleaseJob != null) return;

  const newReleaseJob = await db.transaction(async (tx) =>
    createReleaseJob(tx, release),
  );

  return newReleaseJob;
};

export const evaluateReleaseTarget = async (
  releaseTarget: schema.ReleaseTarget,
) => {
  const workspaceId = await getWorkspaceId(releaseTarget);
  const [versionRelease, variableRelease] = await Promise.all([
    handleVersionRelease(releaseTarget, workspaceId),
    handleVariableRelease(releaseTarget, workspaceId),
  ]);

  if (versionRelease == null) return;

  const currentRelease = await getCurrentRelease(releaseTarget.id);
  if (currentRelease == null) {
    const release = await insertNewRelease(
      versionRelease.id,
      variableRelease.id,
    );

    return dispatchReleaseJob(release);
  }

  const hasAnythingChanged = getHasAnythingChanged(currentRelease, {
    versionReleaseId: versionRelease.id,
    variableReleaseId: variableRelease.id,
  });
  if (!hasAnythingChanged) return currentRelease;

  const release = await insertNewRelease(versionRelease.id, variableRelease.id);
  return dispatchReleaseJob(release);
};
