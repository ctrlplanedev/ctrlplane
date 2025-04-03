import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { and, desc, eq, takeFirstOrNull } from "@ctrlplane/db";
import type { ReleaseRepository } from "@ctrlplane/rule-engine";
import { ReleaseManager } from "@ctrlplane/release-manager";

export const newResourceWorker = createWorker(
    Channel.NewResource,
    async (job) => {
        const resource = job.data;

        const environments = await db.select().from(schema.environment)
            .innerJoin(
                schema.system,
                eq(schema.system.id, schema.environment.systemId),
            ).where(eq(schema.system.workspaceId, resource.workspaceId));

        const deployments = await db.selectDistinctOn([schema.deployment.id])
            .from(schema.deployment)
            .innerJoin(
                schema.system,
                eq(schema.system.id, schema.deployment.systemId),
            ).innerJoin(
                schema.deploymentVersion,
                eq(schema.deploymentVersion.deploymentId, schema.deployment.id),
            ).where(eq(schema.system.workspaceId, resource.workspaceId))
            .orderBy(desc(schema.deploymentVersion.createdAt));

        const releaseRepos: ReleaseRepository[] = [];

        for (const { environment } of environments) {
            for (const { deployment } of deployments) {
                const res = await db.select().from(schema.resource)
                    .where(
                        and(
                            eq(schema.resource.id, resource.id),
                            schema.resourceMatchesMetadata(
                                db,
                                environment.resourceSelector,
                            ),
                            schema.resourceMatchesMetadata(
                                db,
                                deployment.resourceSelector,
                            ),
                        ),
                    ).then(takeFirstOrNull);
                if (res != null) {
                    releaseRepos.push({
                        resourceId: res.id,
                        environmentId: environment.id,
                        deploymentId: deployment.id,
                    });
                }
            }
        }

        const evaluatedQueue = getQueue(Channel.PolicyEvaluate);

        const releaseTargets = await db.insert(schema.releaseTarget)
            .values(releaseRepos).onConflictDoNothing()
            .returning();

        for (const releaseTarget of releaseTargets) {
            job.log(`Created release target ${releaseTarget.id}`);
            const versionId = deployments.find(
                (d) => d.deployment.id === releaseTarget.deploymentId,
            )?.deployment_version.id ?? "unknown";
            const releaseManager = await ReleaseManager.usingDatabase(
                releaseTarget,
            );
            await releaseManager.upsertVersionRelease(versionId, {
                setAsDesired: true,
            });
            job.log(`Created release ${releaseTarget.id}`);
        }

        const jobData = releaseTargets.map((r) => {
            const resourceId = r.resourceId;
            const environmentId = r.environmentId;
            const deploymentId = r.deploymentId;
            return {
                name: `${resourceId}-${environmentId}-${deploymentId}`,
                data: { resourceId, environmentId, deploymentId },
            };
        });

        await evaluatedQueue.addBulk(jobData);
    },
);
