import type { z } from "zod";
import { NextResponse } from "next/server";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { createReleaseChannel } from "@ctrlplane/db/schema";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

export const POST = request()
  .use(authn)
  .use(parseBody(createReleaseChannel))
  .use(
    authz(({ ctx, can }) =>
      can
        .perform(Permission.ReleaseChannelCreate)
        .on({ type: "deployment", id: ctx.body.deploymentId }),
    ),
  )
  .handle<{ body: z.infer<typeof createReleaseChannel> }>(
    async ({ db, body }) => {
      const releaseChannel = await db
        .select()
        .from(SCHEMA.releaseChannel)
        .where(
          and(
            eq(SCHEMA.releaseChannel.deploymentId, body.deploymentId),
            eq(SCHEMA.releaseChannel.name, body.name),
          ),
        )
        .then(takeFirstOrNull);

      if (releaseChannel)
        return NextResponse.json(
          { error: "Release channel already exists" },
          { status: 409 },
        );

      return db
        .insert(SCHEMA.releaseChannel)
        .values(body)
        .returning()
        .then(takeFirst)
        .then((releaseChannel) => NextResponse.json(releaseChannel))
        .catch((error) => NextResponse.json({ error }, { status: 500 }));
    },
  );
