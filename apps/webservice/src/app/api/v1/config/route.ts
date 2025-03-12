import type { Tx } from "@ctrlplane/db";
import type { CacV1 } from "@ctrlplane/validators/cac";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import jsYaml from "js-yaml";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { can } from "@ctrlplane/auth/utils";
import {
  and,
  buildConflictUpdateColumns,
  eq,
  inArray,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  createJobApprovals,
  createReleaseJobTriggers,
  dispatchReleaseJobTriggers,
  isPassingAllPolicies,
  isPassingReleaseStringCheckPolicy,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";
import { cacV1 } from "@ctrlplane/validators/cac";

import { getUser } from "~/app/api/v1/auth";

const { entries, fromEntries } = Object;

const upsertSystems = async (db: Tx, config: CacV1) => {
  if (config.systems == null || entries(config.systems).length == 0) return;

  const systemInserts = entries(config.systems ?? {}).map(([slug, system]) => ({
    name: system.name ?? slug,
    description: system.description ?? "",
    workspaceId: config.workspace,
    slug,
  }));

  if (systemInserts.length == 0) return;

  await db
    .insert(schema.system)
    .values(systemInserts)
    .onConflictDoUpdate({
      target: [schema.system.workspaceId, schema.system.slug],
      set: buildConflictUpdateColumns(schema.system, ["name", "description"]),
    });
};

const upsertDeployments = async (db: Tx, config: CacV1) => {
  if (config.deployments == null || entries(config.deployments).length == 0)
    return;

  const deploymentInfo = entries(config.deployments ?? {})
    .map(([slug, deployment]) => {
      const [systemSlug, deploymentSlug] = slug.split("/");
      if (systemSlug == null || deploymentSlug == null) return null;

      return {
        systemSlug,
        deployment: {
          name: deployment.name ?? deploymentSlug,
          slug: deploymentSlug,
          description: deployment.description ?? "",
          jobAgentId: deployment.jobAgent?.id,
          jobAgentConfig: deployment.jobAgent?.config ?? {},
        },
      };
    })
    .filter(isPresent);
  const systemSlugs = deploymentInfo.map(({ systemSlug }) => systemSlug);

  const systems = await db
    .select()
    .from(schema.system)
    .where(inArray(schema.system.slug, systemSlugs));

  const jobAgentsIds = await db
    .select({ id: schema.jobAgent.id })
    .from(schema.jobAgent)
    .where(
      and(
        inArray(
          schema.jobAgent.id,
          deploymentInfo
            .map(({ deployment }) => deployment.jobAgentId)
            .filter(isPresent),
        ),
        eq(schema.jobAgent.workspaceId, config.workspace),
      ),
    )
    .then((rows) => rows.map(({ id }) => id));

  const systemMap = fromEntries(systems.map((system) => [system.slug, system]));

  const deploymentInserts = deploymentInfo
    .map(({ systemSlug, deployment }) => {
      const system = systemMap[systemSlug];
      if (system == null) return null;
      if (
        deployment.jobAgentId != null &&
        !jobAgentsIds.includes(deployment.jobAgentId)
      )
        return null;
      return { ...deployment, systemId: system.id };
    })
    .filter(isPresent);

  if (deploymentInserts.length == 0) return;

  await db
    .insert(schema.deployment)
    .values(deploymentInserts)
    .onConflictDoUpdate({
      target: [schema.deployment.systemId, schema.deployment.slug],
      set: buildConflictUpdateColumns(schema.deployment, [
        "name",
        "description",
        "jobAgentId",
        "jobAgentConfig",
      ]),
    });
};

const upsertReleases = async (db: Tx, config: CacV1, userId: string) => {
  if (config.releases == null || entries(config.releases).length == 0) return;

  const releaseInfo = entries(config.releases ?? {})
    .map(([slug, release]) => {
      const [systemSlug, deploymentSlug, version] = slug.split("/");
      if (systemSlug == null || deploymentSlug == null || version == null)
        return null;

      const name = release.name ?? version;
      return {
        systemSlug,
        deploymentSlug,
        release: { ...release, version, name },
      };
    })
    .filter(isPresent);

  const systemSlugs = releaseInfo.map(({ systemSlug }) => systemSlug);
  const deploymentSlugs = releaseInfo.map(
    ({ deploymentSlug }) => deploymentSlug,
  );

  const deployments = await db
    .select()
    .from(schema.deployment)
    .innerJoin(schema.system, eq(schema.deployment.systemId, schema.system.id))
    .innerJoin(
      schema.workspace,
      eq(schema.system.workspaceId, schema.workspace.id),
    )
    .leftJoin(
      schema.release,
      eq(schema.release.deploymentId, schema.deployment.id),
    )
    .where(
      and(
        eq(schema.workspace.id, config.workspace),
        inArray(schema.system.slug, systemSlugs),
        inArray(schema.deployment.slug, deploymentSlugs),
      ),
    )
    .then((rows) =>
      _.chain(rows)
        .groupBy((d) => d.deployment.id)
        .map((deploymentGroup) => ({
          ...deploymentGroup[0]!,
          releases: deploymentGroup
            .map((d) => d.deployment_version)
            .filter(isPresent),
        }))
        .value(),
    );

  const newReleases = releaseInfo.filter(
    ({ systemSlug, deploymentSlug, release }) => {
      const deployment = deployments.find(
        (d) =>
          d.deployment.slug === deploymentSlug && d.system.slug === systemSlug,
      );
      if (deployment == null) return false;
      const existingRelease = deployment.releases.find(
        (r) => r.version === release.version,
      );
      return existingRelease == null;
    },
  );

  if (newReleases.length == 0) return;

  const releaseInserts = newReleases
    .map(({ systemSlug, deploymentSlug, release }) => {
      const deployment = deployments.find(
        (d) =>
          d.deployment.slug === deploymentSlug && d.system.slug === systemSlug,
      );
      if (deployment == null) return null;
      return { ...release, deploymentId: deployment.deployment.id };
    })
    .filter(isPresent);

  const releases = await db
    .insert(schema.release)
    .values(releaseInserts)
    .returning();

  const releaseMetadataInserts = newReleases
    .flatMap(({ systemSlug, deploymentSlug, release }) => {
      const deployment = deployments.find(
        (d) =>
          d.deployment.slug === deploymentSlug && d.system.slug === systemSlug,
      );
      if (deployment == null) return [];
      const rel = releases.find(
        (r) =>
          r.version === release.version &&
          r.deploymentId === deployment.deployment.id,
      );
      if (rel == null) return [];
      return entries(release.metadata ?? {}).map(([key, value]) => ({
        releaseId: rel.id,
        key,
        value,
      }));
    })
    .filter(isPresent);

  if (releaseMetadataInserts.length > 0)
    await db.insert(schema.releaseMetadata).values(releaseMetadataInserts);

  await createReleaseJobTriggers(db, "new_release")
    .causedById(userId)
    .filter(isPassingReleaseStringCheckPolicy)
    .releases(releases.map((r) => r.id))
    .then(createJobApprovals)
    .insert()
    .then((releaseJobTriggers) => {
      dispatchReleaseJobTriggers(db)
        .releaseTriggers(releaseJobTriggers)
        .filter(isPassingAllPolicies)
        .then(cancelOldReleaseJobTriggersOnJobDispatch)
        .dispatch();
    });
};

export const PATCH = async (req: NextRequest) => {
  const body = await req.text();
  const bodyObj = jsYaml.load(body);
  const parsed = cacV1.safeParse(bodyObj);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const workspaceId = parsed.data.workspace;

  return db.transaction(async (db) => {
    const workspace = await db
      .select()
      .from(schema.workspace)
      .where(eq(schema.workspace.id, workspaceId))
      .then(takeFirstOrNull);

    if (workspace == null)
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );

    const user = await getUser(req);
    if (user == null)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const canAccess = await can()
      .user(user.id)
      .perform(Permission.SystemUpdate)
      .on({ type: "workspace", id: workspace.id });

    if (!canAccess)
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });

    const config = parsed.data;

    try {
      await upsertSystems(db, config);
      await upsertDeployments(db, config);
      await upsertReleases(db, config, user.id);
    } catch (e) {
      return NextResponse.json({ error: e }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  });
};
