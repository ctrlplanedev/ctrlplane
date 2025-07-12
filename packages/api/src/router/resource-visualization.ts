import _ from "lodash";
import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { getResourceChildren, getResourceParents } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure } from "../trpc";

const getResource = (id: string) =>
  db
    .select()
    .from(schema.resource)
    .where(eq(schema.resource.id, id))
    .then(takeFirst);

const getRootsOfTree = async (
  resource: schema.Resource,
  roots: schema.Resource[],
): Promise<schema.Resource[]> => {
  const parents = await getResourceParents(db, resource.id);
  const hasNoParents = Object.keys(parents.relationships).length === 0;
  if (hasNoParents) return [...roots, resource];

  const retrievedRoots = await Promise.all(
    Object.values(parents.relationships).map((r) =>
      getRootsOfTree(r.target, roots),
    ),
  ).then((roots) => roots.flat());
  return [...retrievedRoots, ...roots];
};

type Edge = {
  targetId: string;
  sourceId: string;
  relationshipType: schema.ResourceRelationshipRule["dependencyType"];
};

class TreeBuilder {
  private resources: schema.Resource[] = [];
  private edges: Edge[] = [];
  constructor() {}

  private addEdge(
    sourceId: string,
    targetId: string,
    relationshipType: schema.ResourceRelationshipRule["dependencyType"],
  ) {
    const edgeAlreadyExists = this.edges.some(
      (e) => e.sourceId === sourceId && e.targetId === targetId,
    );
    if (edgeAlreadyExists) return;
    this.edges.push({ sourceId, targetId, relationshipType });
  }

  private async getChildren(resource: schema.Resource) {
    const resourceChildren = await getResourceChildren(db, resource.id);
    if (resourceChildren.length === 0) return;
    for (const { source, type } of resourceChildren) {
      this.addEdge(resource.id, source.id, type);
      this.resources.push(source);
      await this.getChildren(source);
    }
  }

  async buildFromRoots(roots: schema.Resource[]) {
    this.resources = roots;
    for (const root of roots) await this.getChildren(root);
    return { resources: this.resources, edges: this.edges };
  }
}

const getReleaseTargets = async (resource: schema.Resource) =>
  db
    .select()
    .from(schema.releaseTarget)
    .innerJoin(
      schema.deployment,
      eq(schema.releaseTarget.deploymentId, schema.deployment.id),
    )
    .innerJoin(schema.system, eq(schema.deployment.systemId, schema.system.id))
    .where(eq(schema.releaseTarget.resourceId, resource.id))
    .orderBy(schema.system.slug)
    .then((rows) =>
      rows.map((row) => ({
        ...row.release_target,
        deployment: row.deployment,
        system: row.system,
      })),
    );

const buildResourceNode = async (resource: schema.Resource) => {
  const releaseTargets = await getReleaseTargets(resource);
  const systemsWithReleaseTargets = _.chain(releaseTargets)
    .groupBy((rt) => rt.system.id)
    .map((groupedTargets) => ({
      ...groupedTargets[0]!.system,
      releaseTargets: groupedTargets,
    }))
    .value();
  return { ...resource, systems: systemsWithReleaseTargets };
};

export const resourceVisualization = protectedProcedure
  .input(z.string().uuid())
  .meta({
    authorizationCheck: ({ canUser, input }) =>
      canUser.perform(Permission.ResourceGet).on({
        type: "resource",
        id: input,
      }),
  })
  .query(async ({ input }) => {
    const baseResource = await getResource(input);
    const roots = await getRootsOfTree(baseResource, []);
    const { resources, edges } = await new TreeBuilder().buildFromRoots(roots);
    const resourceNodes = await Promise.all(resources.map(buildResourceNode));
    return { resources: resourceNodes, edges };
  });
