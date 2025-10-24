import { deploymentsRouter } from "./routes/deployments.js";
import { environmentRouter } from "./routes/environments.js";
import { jobsRouter } from "./routes/jobs.js";
import { relationshipsRouter } from "./routes/relationships.js";
import { resourcesRouter } from "./routes/resources.js";
import { systemsRouter } from "./routes/systems.js";
import { userRouter } from "./routes/user.js";
import { validateRouter } from "./routes/validate.js";
import { workspaceRouter } from "./routes/workspace.js";
import { router } from "./trpc.js";

export const appRouter = router({
  user: userRouter,
  resource: resourcesRouter,
  workspace: workspaceRouter,
  deployment: deploymentsRouter,
  system: systemsRouter,
  environment: environmentRouter,
  validate: validateRouter,
  jobs: jobsRouter,
  relationships: relationshipsRouter,
});
