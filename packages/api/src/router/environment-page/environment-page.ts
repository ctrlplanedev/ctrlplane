import { createTRPCRouter } from "../../trpc";
import { overviewRouter } from "./overview";

export const environmentPageRouter = createTRPCRouter({
  overview: overviewRouter,
});
