import { authRouter } from "./routes/auth.js";
import { deploymentTracesRouter } from "./routes/deployment-traces.js";
import { deploymentVersionsRouter } from "./routes/deployment-versions.js";
import { deploymentsRouter } from "./routes/deployments.js";
import { environmentRouter } from "./routes/environments.js";
import { githubRouter } from "./routes/github.js";
import { jobAgentsRouter } from "./routes/job-agents.js";
import { jobsRouter } from "./routes/jobs.js";
import { policiesRouter } from "./routes/policies.js";
import { policySkipsRouter } from "./routes/policy-skips.js";
import { redeployRouter } from "./routes/redeploy.js";
import { relationshipsRouter } from "./routes/relationships.js";
import { resourceProvidersRouter } from "./routes/resource-providers.js";
import { resourcesRouter } from "./routes/resources.js";
import { systemsRouter } from "./routes/systems.js";
import { userRouter } from "./routes/user.js";
import { validateRouter } from "./routes/validate.js";
import { workspaceRouter } from "./routes/workspace.js";
import { router } from "./trpc.js";

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  resource: resourcesRouter,
  workspace: workspaceRouter,
  deployment: deploymentsRouter,
  deploymentVersions: deploymentVersionsRouter,
  deploymentTraces: deploymentTracesRouter,
  system: systemsRouter,
  environment: environmentRouter,
  validate: validateRouter,
  jobs: jobsRouter,
  relationships: relationshipsRouter,
  policies: policiesRouter,
  policySkips: policySkipsRouter,
  redeploy: redeployRouter,
  resourceProviders: resourceProvidersRouter,
  jobAgents: jobAgentsRouter,
  github: githubRouter,
});
