import { dashboardRouter } from "./router/dashboard";
import { deploymentRouter } from "./router/deployment";
import { environmentRouter } from "./router/environment";
import { githubRouter } from "./router/github";
import { invitesRouter } from "./router/invite";
import { jobRouter } from "./router/job";
import { releaseRouter } from "./router/release";
import { systemRouter } from "./router/system";
import { targetRouter } from "./router/target";
import { profileRouter, userRouter } from "./router/user";
import { valueSetRouter } from "./router/value-set";
import { workspaceRouter } from "./router/workspace";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  deployment: deploymentRouter,
  environment: environmentRouter,
  release: releaseRouter,
  system: systemRouter,
  workspace: workspaceRouter,
  job: jobRouter,
  target: targetRouter,
  github: githubRouter,
  dashboard: dashboardRouter,
  valueSet: valueSetRouter,
  invite: invitesRouter,
  profile: profileRouter,
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
