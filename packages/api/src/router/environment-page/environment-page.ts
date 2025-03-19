import { createTRPCRouter } from "../../trpc";
import { overviewRouter } from "./overview/router";

export const environmentPageRouter = createTRPCRouter({
  overview: overviewRouter,
});
