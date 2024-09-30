import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { can } from "@ctrlplane/auth/utils";
import { takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { createRelease } from "@ctrlplane/db/schema";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { getUser } from "~/app/api/v1/auth";

export const POST = async (req: NextRequest) => {
  const user = await getUser(req);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const response = await req.json();
    const body = createRelease.safeParse(response);
    if (!body.success) return NextResponse.json(body.error, { status: 400 });

    const canCreateReleases = await can()
      .user(user.id)
      .perform(Permission.ReleaseCreate)
      .on({ type: "deployment", id: body.data.deploymentId });
    if (!canCreateReleases)
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });

    const release = await db
      .insert(schema.release)
      .values(body.data)
      .returning()
      .then(takeFirst);

    return NextResponse.json(release, { status: 201 });
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
