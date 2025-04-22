import type { PermissionChecker } from "@ctrlplane/auth/utils";
import type { User } from "@ctrlplane/db/schema";
import { NextResponse } from "next/server";
import _ from "lodash";
import { z } from "zod";

import { eq, inArray, takeFirstOrNull, upsertEnv } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { createJobsForNewEnvironment } from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const body = schema.createEnvironment.extend({
  releaseChannels: z.array(z.string()).optional(),
  deploymentVersionChannels: z.array(z.string()).optional(),
});

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
    ({ db, body }) =>
      db.transaction(async (tx) => {
        try {
          const releaseChannels = body.releaseChannels?.length ?? 0;
          const deploymentVersionChannels =
            body.deploymentVersionChannels?.length ?? 0;
          const versionChannels =
            releaseChannels + deploymentVersionChannels > 0
              ? await tx
                  .select()
                  .from(schema.deploymentVersionChannel)
                  .where(
                    inArray(schema.deploymentVersionChannel.id, [
                      ...(body.releaseChannels ?? []),
                      ...(body.deploymentVersionChannels ?? []),
                    ]),
                  )
                  .then((rows) =>
                    _.uniqBy(rows, (r) => r.deploymentId).map((r) => ({
                      channelId: r.id,
                      deploymentId: r.deploymentId,
                    })),
                  )
              : [];

          const existingEnv = await db
            .select()
            .from(schema.environment)
            .where(eq(schema.environment.name, body.name))
            .then(takeFirstOrNull);

          const environment = await upsertEnv(tx, { ...body, versionChannels });

          if (existingEnv != null)
            await getQueue(Channel.UpdateEnvironment).add(environment.id, {
              ...environment,
              oldSelector: existingEnv.resourceSelector,
            });

          if (existingEnv == null)
            await getQueue(Channel.NewEnvironment).add(
              environment.id,
              environment,
            );

          await createJobsForNewEnvironment(tx, environment);
          const { metadata } = body;
          return NextResponse.json({ ...environment, metadata });
        } catch (e) {
          const error = e instanceof Error ? e.message : e;
          logger.error("Failed to create environment", { error });
          return NextResponse.json(
            { error: "Failed to create environment" },
            { status: 500 },
          );
        }
      }),
  );
