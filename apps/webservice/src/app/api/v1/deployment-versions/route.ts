import type { Tx } from "@ctrlplane/db";
import { NextResponse } from "next/server";
import httpStatus from "http-status";
import _ from "lodash";
import { z } from "zod";

import {
  and,
  buildConflictUpdateColumns,
  eq,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";
import { DeploymentVersionStatus } from "@ctrlplane/validators/releases";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const bodySchema = schema.createDeploymentVersion.and(
  z.object({
    metadata: z.record(z.string()).optional(),
    status: z.nativeEnum(DeploymentVersionStatus).optional(),
  }),
);

const getPreviousMetadata = async (db: Tx, versionId: string) =>
  db
    .select()
    .from(schema.deploymentVersionMetadata)
    .where(eq(schema.deploymentVersionMetadata.versionId, versionId))
    .then((rows) => Object.fromEntries(rows.map((r) => [r.key, r.value])));

const getPreviousVersionDependencies = async (db: Tx, versionId: string) =>
  db
    .select()
    .from(schema.versionDependency)
    .where(eq(schema.versionDependency.versionId, versionId));

const getPreviousVersion = async (
  db: Tx,
  deploymentId: string,
  tag: string,
) => {
  const version = await db
    .select()
    .from(schema.deploymentVersion)
    .where(
      and(
        eq(schema.deploymentVersion.deploymentId, deploymentId),
        eq(schema.deploymentVersion.tag, tag),
      ),
    )
    .then(takeFirstOrNull);

  if (version == null) return null;
  const metadata = await getPreviousMetadata(db, version.id);
  const dependencies = await getPreviousVersionDependencies(db, version.id);

  return { ...version, metadata, dependencies };
};

const upsertMetadata = async (
  db: Tx,
  versionId: string,
  metadata: Record<string, string>,
): Promise<Record<string, string>> => {
  const entries = Object.entries(metadata).map(([key, value]) => ({
    versionId,
    key,
    value,
  }));
  if (entries.length === 0) return {};

  const upsertedMetadata = await db
    .insert(schema.deploymentVersionMetadata)
    .values(entries)
    .onConflictDoUpdate({
      target: [
        schema.deploymentVersionMetadata.versionId,
        schema.deploymentVersionMetadata.key,
      ],
      set: buildConflictUpdateColumns(schema.deploymentVersionMetadata, [
        "value",
      ]),
    })
    .returning();

  return Object.fromEntries(upsertedMetadata.map((m) => [m.key, m.value]));
};

const upsertVersionDependencies = async (
  db: Tx,
  versionId: string,
  dependencies: Omit<schema.VersionDependencyInsert, "versionId">[],
) => {
  if (dependencies.length === 0) return [];

  return db
    .insert(schema.versionDependency)
    .values(dependencies.map((d) => ({ ...d, versionId })))
    .onConflictDoUpdate({
      target: [
        schema.versionDependency.versionId,
        schema.versionDependency.deploymentId,
      ],
      set: buildConflictUpdateColumns(schema.versionDependency, [
        "versionSelector",
      ]),
    })
    .returning();
};

const upsertVersion = (db: Tx, body: z.infer<typeof bodySchema>) =>
  db.transaction(async (tx) => {
    const { metadata = {}, name, tag, dependencies } = body;
    const versionName = name ?? tag;

    const depVersion = await db
      .insert(schema.deploymentVersion)
      .values({ ...body, name: versionName })
      .onConflictDoUpdate({
        target: [
          schema.deploymentVersion.deploymentId,
          schema.deploymentVersion.tag,
        ],
        set: buildConflictUpdateColumns(schema.deploymentVersion, [
          "name",
          "status",
          "message",
          "config",
          "jobAgentConfig",
        ]),
      })
      .returning()
      .then(takeFirst);

    const upsertedMetadata = await upsertMetadata(tx, depVersion.id, metadata);
    const upsertedDependencies = await upsertVersionDependencies(
      tx,
      depVersion.id,
      dependencies,
    );

    return {
      ...depVersion,
      metadata: upsertedMetadata,
      dependencies: upsertedDependencies,
    };
  });

export const POST = request()
  .use(authn)
  .use(parseBody(bodySchema))
  .use(
    authz(({ ctx, can }) =>
      can
        .perform(Permission.DeploymentVersionCreate)
        .on({ type: "deployment", id: ctx.body.deploymentId }),
    ),
  )
  .handle<{ body: z.infer<typeof bodySchema> }>(async (ctx) => {
    const { db, body } = ctx;
    const { tag } = body;

    try {
      const prevVersion = await getPreviousVersion(db, body.deploymentId, tag);
      const upsertedVersion = await upsertVersion(db, body);

      const isVersionChanged = !_.isEqual(prevVersion, upsertedVersion);
      if (isVersionChanged)
        getQueue(Channel.NewDeploymentVersion).add(
          upsertedVersion.id,
          upsertedVersion,
        );

      return NextResponse.json(upsertedVersion, { status: httpStatus.CREATED });
    } catch (error) {
      if (error instanceof z.ZodError)
        return NextResponse.json(
          { error: error.errors },
          { status: httpStatus.BAD_REQUEST },
        );

      logger.error("Error creating version:", error);
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: httpStatus.INTERNAL_SERVER_ERROR },
      );
    }
  });
