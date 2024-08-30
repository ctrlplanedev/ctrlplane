import { env } from "../config";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const githubRouter = createTRPCRouter({
  url: protectedProcedure.query(() => env.GITHUB_URL),
  bot: createTRPCRouter({
    name: protectedProcedure.query(() => env.GITHUB_BOT_NAME),
    clientId: protectedProcedure.query(() => env.GITHUB_BOT_CLIENT_ID),
  }),
});

export const runtimeRouter = createTRPCRouter({
  baseUrl: protectedProcedure.query(() => env.BASE_URL),
  github: githubRouter,
});
