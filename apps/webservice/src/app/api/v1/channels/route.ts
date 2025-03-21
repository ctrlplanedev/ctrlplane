import type { z } from "zod";
import { NextResponse } from "next/server";

import { buildConflictUpdateColumns, takeFirst } from "@ctrlplane/db";
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
        .perform(Permission.DeploymentVersionChannelCreate)
        .on({ type: "deployment", id: ctx.body.deploymentId }),
    ),
  )
  .handle<{ body: z.infer<typeof createDeploymentVersionChannel> }>(
    ({ db, body }) =>
      db
        .insert(SCHEMA.deploymentVersionChannel)
        .values(body)
        .onConflictDoUpdate({
          target: [
            SCHEMA.deploymentVersionChannel.deploymentId,
            SCHEMA.deploymentVersionChannel.name,
          ],
          set: buildConflictUpdateColumns(SCHEMA.deploymentVersionChannel, [
            "versionSelector",
          ]),
        })
        .returning()
        .then(takeFirst)
        .then((deploymentVersionChannel) =>
          NextResponse.json(deploymentVersionChannel),
        )
        .catch((error) => NextResponse.json({ error }, { status: 500 })),
  );
