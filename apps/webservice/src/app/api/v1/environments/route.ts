import type { PermissionChecker } from "@ctrlplane/auth/utils";
import type { User } from "@ctrlplane/db/schema";
import { NextResponse } from "next/server";
import _ from "lodash";
import { z } from "zod";

import { eq, takeFirstOrNull, upsertEnv } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const body = schema.createEnvironment.extend({
  releaseChannels: z.array(z.string()).optional(),
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
    async ({ db, body }) => {
      const existingEnv = await db
        .select()
        .from(schema.environment)
        .where(eq(schema.environment.name, body.name))
        .then(takeFirstOrNull);

      const environment = await upsertEnv(db, body);

      if (existingEnv != null)
        await getQueue(Channel.UpdateEnvironment).add(environment.id, {
          ...environment,
          oldSelector: existingEnv.resourceSelector,
        });

      if (existingEnv == null)
        await getQueue(Channel.NewEnvironment).add(environment.id, environment);

      return NextResponse.json(environment);
    },
  );
