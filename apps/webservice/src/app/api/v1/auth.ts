import type { PermissionChecker } from "@ctrlplane/auth/utils";
import type { User } from "@ctrlplane/db/schema";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { can, getUser as getUserFromApiKey } from "@ctrlplane/auth/utils";

import type { Middleware } from "./middleware";

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

export const authz: (
  checker: (args: {
    ctx: any;
    extra: any;
    can: PermissionChecker;
  }) => Promise<boolean>,
) => Middleware<any, { user: User }> =
  (checker) => async (ctx, extra, next) => {
    if (await checker({ ctx, extra, can: can().user(ctx.user.id) }))
      return next(ctx);

    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  };
