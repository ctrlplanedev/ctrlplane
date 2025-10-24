import type { RouteConfig } from "@react-router/dev/routes";
import { route } from "@react-router/dev/routes";

export default [
  route("", "routes/protected.tsx", [
    route(":workspaceSlug", "routes/ws/_layout.tsx", [
      route("deployments", "routes/ws/deployments.tsx"),

      route("deployments", "routes/ws/deployments/_layout.tsx", [
        route(":deploymentId", "routes/ws/deployments/page.$deploymentId.tsx"),
        route(
          ":deploymentId/versions",
          "routes/ws/deployments/page.$deploymentId.versions.tsx",
        ),
        route(
          ":deploymentId/release-targets",
          "routes/ws/deployments/page.$deploymentId.release-targets.tsx",
        ),
        route(
          ":deploymentId/settings",
          "routes/ws/deployments/settings/_layout.tsx",
          [
            route(
              "general",
              "routes/ws/deployments/settings/page.$deploymentId.general.tsx",
            ),
          ],
        ),
      ]),

      route("jobs", "routes/ws/jobs.tsx"),

      route("environments", "routes/ws/environments.tsx"),
      route("environments", "routes/ws/environments/_layout.tsx", [
        route(
          ":environmentId",
          "routes/ws/environments/page.$environmentId.tsx",
        ),
        route(
          ":environmentId/resources",
          "routes/ws/environments/page.$environmentId.resources.tsx",
        ),
        route(
          ":environmentId/settings",
          "routes/ws/environments/settings/_layout.tsx",
          [route("", "routes/ws/environments/settings/general.tsx")],
        ),
      ]),

      route("resources", "routes/ws/resources.tsx"),
      route("relationship-rules", "routes/ws/relationship-rules.tsx"),
      route("systems", "routes/ws/systems.tsx"),
      route("runners", "routes/ws/runners.tsx"),
      route("providers", "routes/ws/providers.tsx"),
      route("policies", "routes/ws/policies.tsx"),

      route("settings", "routes/ws/settings/_layout.tsx", [
        route("general", "routes/ws/settings/general.tsx"),
        route("members", "routes/ws/settings/members.tsx"),
        route("api-keys", "routes/ws/settings/api-keys.tsx"),
      ]),
    ]),
  ]),
  route("login", "routes/auth/login.tsx"),
  route("sign-up", "routes/auth/signup.tsx"),
] satisfies RouteConfig;
