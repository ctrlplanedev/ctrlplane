import { userRouter } from "./routes/user.js";
import { router } from "./trpc.js";

export const appRouter = router({
  user: userRouter,
});
