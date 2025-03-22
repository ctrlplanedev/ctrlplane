import { createTRPCRouter } from "../../trpc";
import { overviewRouter } from "./overview/router";
import { resourcesRouter } from "./resources/router";

export const environmentPageRouter = createTRPCRouter({
  overview: overviewRouter,
  resources: resourcesRouter,
});
