import { dashboardRouter } from "./router/dashboard";
import { deploymentRouter } from "./router/deployment";
import { environmentRouter } from "./router/environment";
import { githubRouter } from "./router/github";
import { jobRouter } from "./router/job";
import { policyRouter } from "./router/policy/router";
import { redeployProcedure } from "./router/redeploy";
import { releaseTargetRouter } from "./router/release-target";
import { resourceSchemaRouter } from "./router/resource-schema";
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
  system: systemRouter,
  workspace: workspaceRouter,
  job: jobRouter,
  resource: resourceRouter,
  releaseTarget: releaseTargetRouter,
  resourceSchema: resourceSchemaRouter,
  github: githubRouter,
  dashboard: dashboardRouter,
  variableSet: variableSetRouter,
  profile: profileRouter,
  user: userRouter,
  runtime: runtimeRouter,
  runbook: runbookRouter,
  policy: policyRouter,

  search: searchRouter,

  redeploy: redeployProcedure,
});

// export type definition of API
export type AppRouter = typeof appRouter;
