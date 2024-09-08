import { env } from "../config";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const runtimeRouter = createTRPCRouter({
  baseUrl: protectedProcedure.query(() => env.BASE_URL),
});
