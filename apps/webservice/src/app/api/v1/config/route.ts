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
  isPassingChannelSelectorPolicy,
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

const upsertVersions = async (db: Tx, config: CacV1, userId: string) => {
  if (config.versions == null || entries(config.versions).length == 0) return;

  const versionInfo = entries(config.versions ?? {})
    .map(([slug, version]) => {
      const [systemSlug, deploymentSlug, tag] = slug.split("/");
      if (systemSlug == null || deploymentSlug == null || tag == null)
        return null;

      const name = version.name ?? tag;
      return {
        systemSlug,
        deploymentSlug,
        version: { ...version, tag, name },
      };
    })
    .filter(isPresent);

  const systemSlugs = versionInfo.map(({ systemSlug }) => systemSlug);
  const deploymentSlugs = versionInfo.map(
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
      schema.deploymentVersion,
      eq(schema.deploymentVersion.deploymentId, schema.deployment.id),
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
          versions: deploymentGroup
            .map((d) => d.deployment_version)
            .filter(isPresent),
        }))
        .value(),
    );

  const newVersions = versionInfo.filter(
    ({ systemSlug, deploymentSlug, version }) => {
      const deployment = deployments.find(
        (d) =>
          d.deployment.slug === deploymentSlug && d.system.slug === systemSlug,
      );
      if (deployment == null) return false;
      const existingVersion = deployment.versions.find(
        (r) => r.tag === version.tag,
      );
      return existingVersion == null;
    },
  );

  if (newVersions.length == 0) return;

  const versionInserts = newVersions
    .map(({ systemSlug, deploymentSlug, version }) => {
      const deployment = deployments.find(
        (d) =>
          d.deployment.slug === deploymentSlug && d.system.slug === systemSlug,
      );
      if (deployment == null) return null;
      return { ...version, deploymentId: deployment.deployment.id };
    })
    .filter(isPresent);

  const versions = await db
    .insert(schema.deploymentVersion)
    .values(versionInserts)
    .returning();

  const versionMetadataInserts = newVersions
    .flatMap(({ systemSlug, deploymentSlug, version }) => {
      const deployment = deployments.find(
        (d) =>
          d.deployment.slug === deploymentSlug && d.system.slug === systemSlug,
      );
      if (deployment == null) return [];
      const ver = versions.find(
        (r) =>
          r.tag === version.tag && r.deploymentId === deployment.deployment.id,
      );
      if (ver == null) return [];
      return entries(version.metadata ?? {}).map(([key, value]) => ({
        versionId: ver.id,
        key,
        value,
      }));
    })
    .filter(isPresent);

  if (versionMetadataInserts.length > 0)
    await db
      .insert(schema.deploymentVersionMetadata)
      .values(versionMetadataInserts);

  await createReleaseJobTriggers(db, "new_version")
    .causedById(userId)
    .filter(isPassingChannelSelectorPolicy)
    .versions(versions.map((r) => r.id))
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
      await upsertVersions(db, config, user.id);
    } catch (e) {
      return NextResponse.json({ error: e }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  });
};
