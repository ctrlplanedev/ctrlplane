import { dashboardRouter } from "./router/dashboard";
import { deploymentRouter } from "./router/deployment";
import { environmentRouter } from "./router/environment";
import { githubRouter } from "./router/github";
import { jobRouter } from "./router/job";
import { releaseRouter } from "./router/release";
import { resourceRouter } from "./router/resources";
import { runbookRouter } from "./router/runbook";
import { runtimeRouter } from "./router/runtime";
import { searchRouter } from "./router/search";
import { systemRouter } from "./router/system";
import { profileRouter, userRouter } from "./router/user";
import { variableSetRouter } from "./router/variable-set";
import { workspaceRouter } from "./router/workspace";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  deployment: deploymentRouter,
  environment: environmentRouter,
  release: releaseRouter,
  system: systemRouter,
  workspace: workspaceRouter,
  job: jobRouter,
  resource: resourceRouter,
  github: githubRouter,
  dashboard: dashboardRouter,
  variableSet: variableSetRouter,
  profile: profileRouter,
  user: userRouter,
  runtime: runtimeRouter,
  runbook: runbookRouter,

  search: searchRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
