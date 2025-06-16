import type { z } from "zod";
import { NextResponse } from "next/server";

import { logger } from "@ctrlplane/logger";

import type { Middleware } from "./middleware";

const log = logger.child({ module: "body-parser" });

export const parseBody: <T extends z.ZodTypeAny>(schema: T) => Middleware =
  (schema) => async (ctx, _, next) => {
    const response = await ctx.req.json();

    const body = schema.safeParse(response);
    if (!body.success) {
      log.error("Failed to parse body", { error: body.error });
      return NextResponse.json(body.error, { status: 400 });
    }

    ctx.body = body.data;
    return next(ctx);
  };
