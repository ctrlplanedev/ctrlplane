import type { Tx } from "@ctrlplane/db";
import { NextResponse } from "next/server";
import { INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";
import _ from "lodash";
import { z } from "zod";

import {
  and,
  buildConflictUpdateColumns,
  eq,
  inArray,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../auth";
import { parseBody } from "../../body-parser";
import { request } from "../../middleware";

const patchSchema = SCHEMA.updateDeploymentVersion.and(
  z.object({ metadata: z.record(z.string()).optional() }),
);

const getPreviousMetadata = async (db: Tx, versionId: string) =>
  db
    .select()
    .from(SCHEMA.deploymentVersionMetadata)
    .where(eq(SCHEMA.deploymentVersionMetadata.versionId, versionId))
    .then((rows) => Object.fromEntries(rows.map((r) => [r.key, r.value])));

const getPreviousVersionDependencies = async (db: Tx, versionId: string) =>
  db
    .select()
    .from(SCHEMA.versionDependency)
    .where(eq(SCHEMA.versionDependency.versionId, versionId));

const getPreviousVersion = async (db: Tx, versionId: string) => {
  const version = await db
    .select()
    .from(SCHEMA.deploymentVersion)
    .where(eq(SCHEMA.deploymentVersion.id, versionId))
    .then(takeFirstOrNull);

  if (version == null) return null;
  const metadata = await getPreviousMetadata(db, version.id);
  const dependencies = await getPreviousVersionDependencies(db, version.id);

  return { ...version, metadata, dependencies };
};

const updateVersion = async (
  db: Tx,
  versionId: string,
  body: z.infer<typeof patchSchema>,
) =>
  db
    .update(SCHEMA.deploymentVersion)
    .set(body)
    .where(eq(SCHEMA.deploymentVersion.id, versionId))
    .returning()
    .then(takeFirst);

const updateMetadata = async (
  db: Tx,
  versionId: string,
  metadata?: Record<string, string>,
) => {
  const existingMetadata = await getPreviousMetadata(db, versionId);
  if (metadata === undefined) return existingMetadata;
  const deletedMetadataKeys = Object.keys(existingMetadata).filter(
    (key) => !metadata[key],
  );

  if (deletedMetadataKeys.length > 0)
    await db
      .delete(SCHEMA.deploymentVersionMetadata)
      .where(
        and(
          eq(SCHEMA.deploymentVersionMetadata.versionId, versionId),
          inArray(SCHEMA.deploymentVersionMetadata.key, deletedMetadataKeys),
        ),
      );

  const entries = Object.entries(metadata).map(([key, value]) => ({
    versionId,
    key,
    value,
  }));
  if (entries.length === 0) return {};

  const newMetadata = await db
    .insert(SCHEMA.deploymentVersionMetadata)
    .values(entries)
    .onConflictDoUpdate({
      target: [
        SCHEMA.deploymentVersionMetadata.versionId,
        SCHEMA.deploymentVersionMetadata.key,
      ],
      set: buildConflictUpdateColumns(SCHEMA.deploymentVersionMetadata, [
        "value",
      ]),
    })
    .returning();

  return Object.fromEntries(newMetadata.map(({ key, value }) => [key, value]));
};

const updateVersionDependencies = async (
  db: Tx,
  versionId: string,
  dependencies?: Omit<SCHEMA.VersionDependencyInsert, "versionId">[],
) => {
  const existingDependencies = await getPreviousVersionDependencies(
    db,
    versionId,
  );
  if (dependencies === undefined) return existingDependencies;

  const deletedDependencies = existingDependencies.filter(
    (dependency) =>
      !dependencies.some((d) => d.deploymentId === dependency.deploymentId),
  );

  if (deletedDependencies.length > 0)
    await db.delete(SCHEMA.versionDependency).where(
      and(
        eq(SCHEMA.versionDependency.versionId, versionId),
        inArray(
          SCHEMA.versionDependency.deploymentId,
          deletedDependencies.map((d) => d.deploymentId),
        ),
      ),
    );

  const entries = dependencies.map((d) => ({ ...d, versionId }));
  if (entries.length === 0) return [];

  const newDependencies = await db
    .insert(SCHEMA.versionDependency)
    .values(entries)
    .onConflictDoUpdate({
      target: [
        SCHEMA.versionDependency.versionId,
        SCHEMA.versionDependency.deploymentId,
      ],
      set: buildConflictUpdateColumns(SCHEMA.versionDependency, [
        "versionSelector",
      ]),
    })
    .returning();

  return newDependencies;
};

export const PATCH = request()
  .use(authn)
  .use(parseBody(patchSchema))
  .use(
    authz(({ can, params }) =>
      can.perform(Permission.DeploymentVersionUpdate).on({
        type: "deploymentVersion",
        id: params.deploymentVersionId ?? "",
      }),
    ),
  )
  .handle<
    { body: z.infer<typeof patchSchema> },
    { params: Promise<{ deploymentVersionId: string }> }
  >(async (ctx, { params }) => {
    const { deploymentVersionId } = await params;
    const { body } = ctx;

    const prevDeploymentVersion = await getPreviousVersion(
      ctx.db,
      deploymentVersionId,
    );
    if (prevDeploymentVersion == null)
      return NextResponse.json(
        { error: "Deployment version not found" },
        { status: NOT_FOUND },
      );

    try {
      const deploymentVersion = await ctx.db.transaction(async (tx) => {
        const deploymentVersion = await updateVersion(
          tx,
          deploymentVersionId,
          body,
        );

        const metadata = await updateMetadata(
          tx,
          deploymentVersionId,
          body.metadata,
        );
        const dependencies = await updateVersionDependencies(
          tx,
          deploymentVersionId,
          body.dependencies,
        );

        return { ...deploymentVersion, metadata, dependencies };
      });

      const shouldTrigger = !_.isEqual(
        prevDeploymentVersion,
        deploymentVersion,
      );
      if (!shouldTrigger) return NextResponse.json(deploymentVersion);

      await eventDispatcher.dispatchDeploymentVersionUpdated(
        prevDeploymentVersion,
        deploymentVersion,
      );

      return NextResponse.json(deploymentVersion);
    } catch (error) {
      logger.error(error);
      return NextResponse.json(
        { error: "Failed to update version" },
        { status: INTERNAL_SERVER_ERROR },
      );
    }
  });
