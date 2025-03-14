import type { NextRequest } from "next/server";

import { db } from "@ctrlplane/db/client";

export type BaseContext = {
  req: NextRequest;
  db: typeof db;
  [key: string]: unknown;
};

export type Context<T = object> = BaseContext & T;

export type Handler<
  C extends BaseContext = BaseContext,
  E extends object|Promise<object> = object,
> = (ctx: C, extra: E) => Promise<Response>;

export type Middleware<TNext = object, TPrev = object, Extra = object> = (
  ctx: Context<TPrev>,
  extra: Extra,
  next: (ctx: Context<TNext>) => Promise<Response>,
) => Promise<Response>;

export const request = () => {
  const middlewares: Middleware<any, any>[] = [];

  const use = <TPrev = object, TNext = object>(
    middleware: Middleware<TPrev, TNext>,
  ) => {
    middlewares.push(middleware as Middleware<any, any>);
    return { use, handle };
  };

  const handle =
    <TContext = object, Extra extends object = object>(
      handler: Handler<TContext & BaseContext, Extra>,
    ) =>
    (req: NextRequest, extra: Extra) => {
      let index = 0;
      const ctx: Context = { req, db };

      const next = (ctx: Context): Promise<Response> => {
        if (index >= middlewares.length)
          return handler(ctx as TContext & BaseContext, extra);
        const middleware = middlewares[index++];
        return middleware!(ctx, extra, next);
      };

      return next(ctx);
    };

  return { use, handle };
};
