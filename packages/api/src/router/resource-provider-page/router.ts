import { createTRPCRouter } from "../../trpc";
import { overviewRouter } from "./overview/router";

export const resourceProviderPageRouter = createTRPCRouter({
  overview: overviewRouter,
});
