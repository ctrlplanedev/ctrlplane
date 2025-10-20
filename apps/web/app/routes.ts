import type { RouteConfig } from "@react-router/dev/routes";
import { index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/_layout.tsx", [
    index("routes/home.tsx"),
    route("deployments", "routes/deployments/page.tsx", {
      id: "deployments.page",
    }),
    route(
      "deployments/:deploymentId",
      "routes/deployments/page.$deploymentId.tsx",
    ),
    route("resources", "routes/resources.tsx"),
  ]),
] satisfies RouteConfig;
