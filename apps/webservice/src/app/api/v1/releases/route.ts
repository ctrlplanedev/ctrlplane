import { NextResponse } from "next/server";
import { z } from "zod";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { createRelease } from "@ctrlplane/db/schema";
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

import { authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const bodySchema = createRelease.and(
  z.object({ metadata: z.record(z.string()).optional() }),
);

export const POST = request()
  // .use(authn)
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
      const { metadata = {} } = body;

      try {
        const existingRelease = await db
          .select()
          .from(schema.release)
          .where(
            and(
              eq(schema.release.deploymentId, body.deploymentId),
              eq(schema.release.version, body.version),
            ),
          )
          .then(takeFirstOrNull);

        if (existingRelease)
          return NextResponse.json(
            { error: "Release already exists", releaseId: existingRelease.id },
            { status: 409 },
          );

        const release = await db
          .insert(schema.release)
          .values(body)
          .returning()
          .then(takeFirst);

        if (Object.keys(metadata).length > 0)
          await db.insert(schema.releaseMetadata).values(
            Object.entries(metadata).map(([key, value]) => ({
              releaseId: release.id,
              key,
              value,
            })),
          );

        createReleaseJobTriggers(db, "new_release")
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
          .then(() => {
            logger.info(
              `Release for ${release.id} job triggers created and dispatched.`,
              req,
            );
          });

        return NextResponse.json({ ...release, metadata }, { status: 201 });
      } catch (error) {
        if (error instanceof z.ZodError)
          return NextResponse.json({ error: error.errors }, { status: 400 });

        logger.error("Error creating release:", error);
        return NextResponse.json(
          { error: "Internal Server Error" },
          { status: 500 },
        );
      }
    },
  );
