import type { Middleware } from "./middleware";

export const queryParams: Middleware = (ctx, extra, next) => {
  const { req } = ctx;
  const { url } = req;
  const { searchParams } = new URL(url);
  const query = Object.fromEntries(searchParams.entries());
  Object.assign(extra, { query });
  console.log("extra", extra);
  return next(ctx);
};
