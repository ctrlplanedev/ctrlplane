import { resourcesRouter } from "./routes/resources.js";
import { userRouter } from "./routes/user.js";
import { router } from "./trpc.js";

export const appRouter = router({
  user: userRouter,
  resources: resourcesRouter,
});
