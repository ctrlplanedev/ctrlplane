import { NextResponse } from "next/server";
import httpStatus from "http-status";
import { z } from "zod";

import { takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const log = logger.child({ module: "api/v1/systems" });

export const POST = request()
  .use(authn)
  .use(parseBody(schema.createSystem))
  .use(
    authz(({ ctx, can }) =>
      can
        .perform(Permission.SystemCreate)
        .on({ type: "workspace", id: ctx.body.workspaceId }),
    ),
  )
  .handle<{ body: z.infer<typeof schema.createSystem> }>(async (ctx) =>
    ctx.db
      .insert(schema.system)
      .values(ctx.body)
      .returning()
      .then(takeFirst)
      .then((system) =>
        NextResponse.json({ system }, { status: httpStatus.CREATED }),
      )
      .catch((error) => {
        if (error instanceof z.ZodError)
          return NextResponse.json(
            { error: error.errors },
            { status: httpStatus.BAD_REQUEST },
          );

        log.error("Error creating system:", error);
        return NextResponse.json(
          { error: "Internal Server Error" },
          { status: httpStatus.INTERNAL_SERVER_ERROR },
        );
      }),
  );
