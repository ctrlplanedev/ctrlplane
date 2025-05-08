import type { PermissionChecker } from "@ctrlplane/auth/utils";
import type { User } from "@ctrlplane/db/schema";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { can, getUser as getUserFromApiKey } from "@ctrlplane/auth/utils";
import { logger } from "@ctrlplane/logger";

import type { Context, Middleware } from "./middleware";

export const getUser = async (req: NextRequest) =>
  req.headers.get("x-api-key") != null
    ? getUserFromApiKey(req.headers.get("x-api-key")!)
    : null;

export const authn: Middleware = async (ctx, _, next) => {
  const user = await getUser(ctx.req);
  if (user == null)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return next({ ...ctx, user, canUser: can().user(user.id) });
};

const log = logger.child({ module: "api/v1/auth" });

export const authz: (
  checker: (args: {
    ctx: Context<{ user: User; body: any }>;
    extra: any;
    can: PermissionChecker;
    params: Record<string, string>;
  }) => Promise<boolean>,
) => Middleware<any, { user: User; body: any }> =
  (checker) => async (ctx, extra, next) => {
    try {
      const allowed = await checker({
        ctx,
        extra,
        params: await (extra as any).params,
        can: can().user(ctx.user.id),
      });
      if (!allowed)
        return NextResponse.json(
          { error: "Permission denied" },
          { status: 403 },
        );

      return next(ctx);
    } catch (error: any) {
      log.error("Permission check failed", { error });
      return NextResponse.json(
        {
          error: "Permission check failed",
          message:
            error?.message ||
            "An unexpected error occurred during permission check",
          code: "PERMISSION_CHECK_ERROR",
        },
        { status: 500 },
      );
    }
  };
