import type { z } from "zod";
import { NextResponse } from "next/server";

import type { Middleware } from "./middleware";

export const parseBody: <T extends z.ZodTypeAny>(schema: T) => Middleware =
  (schema) => async (ctx, _, next) => {
    const response = await ctx.req.json();

    const body = schema.safeParse(response);
    if (!body.success) return NextResponse.json(body.error, { status: 400 });

    ctx.body = body.data;
    return next(ctx);
  };
