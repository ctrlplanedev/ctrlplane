import type { inferRouterOutputs } from "@trpc/server";

import { appRouter } from "./root.js";

export * from "./trpc.js";
export { appRouter };
export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
