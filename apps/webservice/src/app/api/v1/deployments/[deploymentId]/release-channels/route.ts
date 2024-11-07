import type { User } from "@ctrlplane/db/schema";
import type { z } from "zod";
import { NextResponse } from "next/server";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { createReleaseChannel } from "@ctrlplane/db/schema";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../../auth";
import { parseBody } from "../../../body-parser";
import { request } from "../../../middleware";

const postBodySchema = createReleaseChannel.omit({ deploymentId: true });

export const POST = request()
  .use(authn)
  .use(parseBody(postBodySchema))
  .use(
    authz(({ can, extra }) =>
      can
        .perform(Permission.ReleaseChannelCreate)
        .on({ type: "deployment", id: extra.params.deploymentId }),
    ),
  )
  .handle<
    { user: User; body: z.infer<typeof postBodySchema> },
    { params: { deploymentId: string } }
  >(async (ctx, extra) => {
    const releaseChannel = await ctx.db
      .select()
      .from(schema.releaseChannel)
      .where(
        and(
          eq(schema.releaseChannel.deploymentId, extra.params.deploymentId),
          eq(schema.releaseChannel.name, ctx.body.name),
        ),
      )
      .then(takeFirstOrNull);

    if (releaseChannel)
      return NextResponse.json(
        { error: "Release channel already exists" },
        { status: 409 },
      );

    return ctx.db
      .insert(schema.releaseChannel)
      .values({ ...ctx.body, deploymentId: extra.params.deploymentId })
      .returning()
      .then(takeFirst)
      .then((releaseChannel) => NextResponse.json(releaseChannel))
      .catch((error) => NextResponse.json({ error }, { status: 500 }));
  });
