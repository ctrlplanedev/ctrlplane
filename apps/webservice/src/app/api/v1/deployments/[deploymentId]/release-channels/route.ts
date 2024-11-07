import type { User } from "@ctrlplane/db/schema";
import type { z } from "zod";
import { NextResponse } from "next/server";

import { buildConflictUpdateColumns } from "@ctrlplane/db";
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
      .insert(schema.releaseChannel)
      .values({ ...ctx.body, deploymentId: extra.params.deploymentId })
      .onConflictDoUpdate({
        target: [
          schema.releaseChannel.deploymentId,
          schema.releaseChannel.name,
        ],
        set: buildConflictUpdateColumns(schema.releaseChannel, [
          "releaseFilter",
        ]),
      })
      .returning();
    return NextResponse.json(releaseChannel);
  });
