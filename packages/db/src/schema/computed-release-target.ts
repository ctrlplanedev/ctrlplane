// import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";

// import { deployment } from "./deployment.js";
// import { environment } from "./environment.js";
// import { release } from "./release.js";
// import { resource } from "./resource.js";

// export const computedReleaseTarget = pgTable(
//   "computed_release_target",
//   {
//     resourceId: uuid("resource_id")
//       .notNull()
//       .references(() => resource.id),
//     environmentId: uuid("environment_id")
//       .notNull()
//       .references(() => environment.id),
//     deploymentId: uuid("deployment_id")
//       .notNull()
//       .references(() => deployment.id),

//     computedAt: timestamp("computed_at", { withTimezone: true })
//       .notNull()
//       .defaultNow(),

//     desiredReleaseId: uuid("desired_release_id").references(() => release.id),
//     // desiredReleaseComputedAt: timestamp("desired_release_computed_at", {
//     //   withTimezone: true,
//     // })
//   },
//   (t) => [
//     primaryKey({ columns: [t.resourceId, t.environmentId, t.deploymentId] }),
//   ],
// );
