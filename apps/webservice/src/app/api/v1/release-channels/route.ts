import type { z } from "zod";
import { NextResponse } from "next/server";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { createDeploymentVersionChannel } from "@ctrlplane/db/schema";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

export const POST = request()
  .use(authn)
  .use(parseBody(createDeploymentVersionChannel))
  .use(
    authz(({ ctx, can }) =>
      can
        .perform(Permission.ReleaseChannelCreate)
        .on({ type: "deployment", id: ctx.body.deploymentId }),
    ),
  )
  .handle<{ body: z.infer<typeof createDeploymentVersionChannel> }>(
    async ({ db, body }) => {
      const releaseChannel = await db
        .select()
        .from(SCHEMA.deploymentVersionChannel)
        .where(
          and(
            eq(SCHEMA.deploymentVersionChannel.deploymentId, body.deploymentId),
            eq(SCHEMA.deploymentVersionChannel.name, body.name),
          ),
        )
        .then(takeFirstOrNull);

      if (releaseChannel)
        return NextResponse.json(
          { error: "Release channel already exists", id: releaseChannel.id },
          { status: 409 },
        );

      return db
        .insert(SCHEMA.deploymentVersionChannel)
        .values(body)
        .returning()
        .then(takeFirst)
        .then((releaseChannel) => NextResponse.json(releaseChannel))
        .catch((error) => NextResponse.json({ error }, { status: 500 }));
    },
  );
