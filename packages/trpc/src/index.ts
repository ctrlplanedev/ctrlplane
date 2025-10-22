import { appRouter } from "./root.js";

export * from "./trpc.js";
export { appRouter };
export type AppRouter = typeof appRouter;
