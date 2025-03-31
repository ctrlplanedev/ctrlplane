// import type { Tx } from "@ctrlplane/db";
// import _ from "lodash";

// import { and, eq, takeFirst } from "@ctrlplane/db";
// import * as schema from "@ctrlplane/db/schema";

// import { ReleaseManager } from "./manager.js";

// /**
//  * Retrieves system resources for a given system
//  */
// const getSystemResources = async (tx: Tx, systemId: string) => {
//   const system = await tx.query.system.findFirst({
//     where: eq(schema.system.id, systemId),
//     with: { environments: true },
//   });

//   if (system == null) throw new Error("System not found");

//   const { environments } = system;

//   // Simplify the chained operations with standard Promise.all
//   const resources = await Promise.all(
//     environments.map(async (env) => {
//       const res = await tx
//         .select()
//         .from(schema.resource)
//         .where(
//           and(
//             eq(schema.resource.workspaceId, system.workspaceId),
//             schema.resourceMatchesMetadata(tx, env.resourceSelector),
//           ),
//         );
//       return res.map((r) => ({ ...r, environment: env }));
//     }),
//   ).then((arrays) => arrays.flat());

//   return resources;
// };

// /**
//  * Releases a new version for a deployment across all resources
//  */
// export const releaseNewVersion = async (tx: Tx, versionId: string) => {
//   // Get deployment, version and system in a single query
//   const {
//     deployment_version: version,
//     deployment,
//     system,
//   } = await tx
//     .select()
//     .from(schema.deploymentVersion)
//     .innerJoin(
//       schema.deployment,
//       eq(schema.deploymentVersion.deploymentId, schema.deployment.id),
//     )
//     .innerJoin(schema.system, eq(schema.deployment.systemId, schema.system.id))
//     .where(eq(schema.deploymentVersion.id, versionId))
//     .then(takeFirst);

//   // Get all resources for this system
//   const resources = await getSystemResources(tx, system.id);

//   // Create a release manager for each resource and ensure the release
//   const releaseManagers = resources.map(
//     (r) =>
//       new ReleaseManager({
//         db: tx,
//         deploymentId: deployment.id,
//         environmentId: r.environment.id,
//         resourceId: r.id,
//       }),
//   );

//   await Promise.all(releaseManagers.map((rm) => rm.ensureRelease(version.id)));
// };
