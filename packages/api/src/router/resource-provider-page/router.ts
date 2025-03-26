import { createTRPCRouter } from "../../trpc";
import { overviewRouter } from "./overview-router";
import { resourceDistributionRouter } from "./resource-distribution-router";

export const resourceProviderPageRouter = createTRPCRouter({
  overview: overviewRouter,
  distribution: resourceDistributionRouter,
});
