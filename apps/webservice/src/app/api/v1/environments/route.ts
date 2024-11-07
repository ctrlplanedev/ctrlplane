import type { PermissionChecker } from "@ctrlplane/auth/utils";
import type { Tx } from "@ctrlplane/db";
import type { User } from "@ctrlplane/db/schema";
import { NextResponse } from "next/server";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { createJobsForNewEnvironment } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const body = schema.createEnvironment.extend({
  expiresAt: z.coerce
    .date()
    .min(new Date(), "Expires at must be in the future")
    .optional(),
});

const createReleaseChannels = (
  db: Tx,
  environmentId: string,
  releaseChannels: { channelId: string; deploymentId: string }[],
) =>
  db.insert(schema.environmentReleaseChannel).values(
    releaseChannels.map(({ channelId, deploymentId }) => ({
      environmentId,
      channelId,
      deploymentId,
    })),
  );

export const POST = request()
  .use(authn)
  .use(parseBody(body))
  .use(
    authz(({ ctx, can }) =>
      can
        .perform(Permission.SystemUpdate)
        .on({ type: "system", id: ctx.body.systemId }),
    ),
  )
  .handle<{ user: User; can: PermissionChecker; body: z.infer<typeof body> }>(
    (ctx) =>
      ctx.db
        .insert(schema.environment)
        .values({
          ...ctx.body,
          expiresAt: isPresent(ctx.body.expiresAt)
            ? new Date(ctx.body.expiresAt)
            : undefined,
        })
        .returning()
        .then(takeFirst)
        .then(async (environment) => {
          if (
            isPresent(ctx.body.releaseChannels) &&
            ctx.body.releaseChannels.length > 0
          )
            await createReleaseChannels(
              ctx.db,
              environment.id,
              ctx.body.releaseChannels,
            );
          await createJobsForNewEnvironment(ctx.db, environment);
          return NextResponse.json({ environment });
        })
        .catch((error) => {
          if (
            error.code === "23505" &&
            error.constraint === "environment_system_id_name_key"
          ) {
            return NextResponse.json(
              {
                error:
                  "An environment with this name already exists in this system.",
              },
              { status: 409 },
            );
          }
          return NextResponse.json(
            { error: "Failed to create environment" },
            { status: 500 },
          );
        }),
  );
