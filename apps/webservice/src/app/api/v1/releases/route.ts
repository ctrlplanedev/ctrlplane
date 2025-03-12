import { NextResponse } from "next/server";
import httpStatus from "http-status";
import { z } from "zod";

import {
  and,
  buildConflictUpdateColumns,
  eq,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  createJobApprovals,
  createReleaseJobTriggers,
  dispatchReleaseJobTriggers,
  isPassingAllPolicies,
  isPassingReleaseStringCheckPolicy,
} from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";
import { ReleaseStatus } from "@ctrlplane/validators/releases";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const bodySchema = schema.createRelease.and(
  z.object({
    metadata: z.record(z.string()).optional(),
    status: z.nativeEnum(ReleaseStatus).optional(),
  }),
);

export const POST = request()
  .use(authn)
  .use(parseBody(bodySchema))
  .use(
    authz(({ ctx, can }) =>
      can
        .perform(Permission.ReleaseCreate)
        .on({ type: "deployment", id: ctx.body.deploymentId }),
    ),
  )
  .handle<{ user: schema.User; body: z.infer<typeof bodySchema> }>(
    async (ctx) => {
      const { req, body } = ctx;
      const { name, version, metadata = {} } = body;
      const relName = name == null || name === "" ? version : name;

      try {
        const prevRelease = await db
          .select()
          .from(schema.deploymentVersion)
          .where(
            and(
              eq(schema.deploymentVersion.deploymentId, body.deploymentId),
              eq(schema.deploymentVersion.version, version),
            ),
          )
          .then(takeFirstOrNull);

        const release = await db
          .insert(schema.deploymentVersion)
          .values({ ...body, name: relName })
          .onConflictDoUpdate({
            target: [
              schema.deploymentVersion.deploymentId,
              schema.deploymentVersion.version,
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

        if (Object.keys(metadata).length > 0)
          await db
            .insert(schema.releaseMetadata)
            .values(
              Object.entries(metadata).map(([key, value]) => ({
                releaseId: release.id,
                key,
                value,
              })),
            )
            .onConflictDoUpdate({
              target: [
                schema.releaseMetadata.releaseId,
                schema.releaseMetadata.key,
              ],
              set: buildConflictUpdateColumns(schema.releaseMetadata, [
                "value",
              ]),
            });

        const shouldTrigger =
          prevRelease == null ||
          (prevRelease.status !== ReleaseStatus.Ready &&
            release.status === ReleaseStatus.Ready);

        if (shouldTrigger)
          await createReleaseJobTriggers(db, "new_release")
            .causedById(ctx.user.id)
            .filter(isPassingReleaseStringCheckPolicy)
            .releases([release.id])
            .then(createJobApprovals)
            .insert()
            .then((releaseJobTriggers) => {
              dispatchReleaseJobTriggers(db)
                .releaseTriggers(releaseJobTriggers)
                .filter(isPassingAllPolicies)
                .then(cancelOldReleaseJobTriggersOnJobDispatch)
                .dispatch();
            })
            .then(() =>
              logger.info(
                `Release for ${release.id} job triggers created and dispatched.`,
                req,
              ),
            );

        return NextResponse.json(
          { ...release, metadata },
          { status: httpStatus.CREATED },
        );
      } catch (error) {
        if (error instanceof z.ZodError)
          return NextResponse.json(
            { error: error.errors },
            { status: httpStatus.BAD_REQUEST },
          );

        logger.error("Error creating release:", error);
        return NextResponse.json(
          { error: "Internal Server Error" },
          { status: httpStatus.INTERNAL_SERVER_ERROR },
        );
      }
    },
  );
