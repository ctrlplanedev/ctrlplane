import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { can } from "@ctrlplane/auth/utils";
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

import { getUser } from "~/app/api/v1/auth";

const bodySchema = createRelease.and(
  z.object({ metadata: z.record(z.string()).optional() }),
);

export const POST = async (req: NextRequest) => {
  const user = await getUser(req);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const response = await req.json();
    const body = bodySchema.safeParse(response);
    if (!body.success) return NextResponse.json(body.error, { status: 400 });

    const { metadata = {}, ...releaseData } = body.data;
    const canCreateReleases = await can()
      .user(user.id)
      .perform(Permission.ReleaseCreate)
      .on({ type: "deployment", id: body.data.deploymentId });
    if (!canCreateReleases)
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });

    const existingRelease = await db
      .select()
      .from(schema.release)
      .where(
        and(
          eq(schema.release.deploymentId, releaseData.deploymentId),
          eq(schema.release.version, releaseData.version),
        ),
      )
      .then(takeFirstOrNull);

    if (existingRelease)
      return NextResponse.json(
        { error: "Release already exists" },
        { status: 409 },
      );

    const release = await db
      .insert(schema.release)
      .values(releaseData)
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
      .causedById(user.id)
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
};
