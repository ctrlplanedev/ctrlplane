import type { PgColumn, Tx } from "@ctrlplane/db";

import { and, eq, inArray } from "@ctrlplane/db";
import {
  deployment,
  environment,
  release,
  system,
  target,
  targetProvider,
  workspace,
  workspaceMember,
} from "@ctrlplane/db/schema";

const createBaseQuery = (db: Tx) =>
  db
    .select()
    .from(workspaceMember)
    .innerJoin(workspace, eq(workspace.id, workspaceMember.workspaceId));

const createSystemBaseQuery = (db: Tx) =>
  createBaseQuery(db).innerJoin(system, eq(system.workspaceId, workspace.id));

const createDeploymentBaseQuery = (db: Tx) =>
  createSystemBaseQuery(db).innerJoin(
    deployment,
    eq(deployment.systemId, system.id),
  );

const createReleaseBaseQuery = (db: Tx) =>
  createDeploymentBaseQuery(db).innerJoin(
    release,
    eq(release.deploymentId, release.id),
  );

const createEnvironmentBaseQuery = (db: Tx) =>
  createSystemBaseQuery(db).innerJoin(
    environment,
    eq(environment.systemId, system.id),
  );

const createTargetProviderBaseQuery = (db: Tx) =>
  createBaseQuery(db).innerJoin(
    targetProvider,
    eq(targetProvider.workspaceId, workspace.id),
  );

const createTargetBaseQuery = (db: Tx) =>
  createTargetProviderBaseQuery(db).innerJoin(
    target,
    eq(target.providerId, targetProvider.id),
  );

const evaluate =
  (
    base: ReturnType<typeof createBaseQuery>,
    userId: string | null | undefined,
    entityColumn: PgColumn,
  ) =>
  async (id: string) =>
    userId == null
      ? false
      : base
          .where(and(eq(workspaceMember.userId, userId), eq(entityColumn, id)))
          .then((a) => a.length > 0);

const evaluateMultiple =
  (
    base: ReturnType<typeof createBaseQuery>,
    userId: string | null | undefined,
    entityColumn: PgColumn,
  ) =>
  async (ids: string[]) =>
    userId == null
      ? false
      : base
          .where(
            and(eq(workspaceMember.userId, userId), inArray(entityColumn, ids)),
          )
          .then((a) => a.length > 0);

export const accessQuery = (db: Tx, userId?: string) => {
  const base = createBaseQuery(db);

  const systemBase = createSystemBaseQuery(db);
  const deploymentBase = createDeploymentBaseQuery(db);
  const releaseBase = createReleaseBaseQuery(db);
  const environmentBase = createEnvironmentBaseQuery(db);
  const systemAccess = {
    id: evaluate(systemBase, userId, system.id),
    slug: evaluate(systemBase, userId, system.slug),
    environment: {
      id: evaluate(environmentBase, userId, environment.id),
    },
    deployment: {
      id: evaluate(deploymentBase, userId, deployment.id),
      slug: evaluate(deploymentBase, userId, deployment.slug),
      release: {
        id: evaluate(releaseBase, userId, release.id),
      },
    },
  };

  const targetBase = createTargetBaseQuery(db);
  const targetAccess = {
    id: evaluate(targetBase, userId, target.id),
    ids: evaluateMultiple(targetBase, userId, target.id),
  };
  const targetProviderBase = createTargetProviderBaseQuery(db);
  const targetProviderAccess = {
    id: evaluate(targetProviderBase, userId, targetProvider.id),
  };

  return {
    workspace: {
      id: evaluate(base, userId, workspace.id),
      slug: evaluate(base, userId, workspace.slug),
      target: targetAccess,
      targetProvider: targetProviderAccess,
      system: systemAccess,
    },
  };
};
