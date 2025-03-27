import { createTRPCRouter } from "../../trpc";
import { healthRouter } from "./health-router";
import { overviewRouter } from "./overview-router";
import { providerListRouter } from "./provider-list-router";
import { resourceDistributionRouter } from "./resource-distribution-router";

export const resourceProviderPageRouter = createTRPCRouter({
  overview: overviewRouter,
  distribution: resourceDistributionRouter,
  health: healthRouter,
  list: providerListRouter,
});
