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

type Edge = {
  targetId: string;
  sourceId: string;
  relationshipType: schema.ResourceRelationshipRule["dependencyType"];
};

class TreeBuilder {
  private resources: schema.Resource[] = [];
  private edges: Edge[] = [];
  constructor(private baseResource: schema.Resource) {}

  private async getRoots(
    resource: schema.Resource,
    roots: schema.Resource[],
    seen: Set<string>,
  ): Promise<schema.Resource[]> {
    if (seen.has(resource.id)) return [];
    seen.add(resource.id);

    const parents = await getResourceParents(db, resource.id);
    const hasNoParents = Object.keys(parents.relationships).length === 0;
    if (hasNoParents) return [...roots, resource];

    const retrievedRoots = await Promise.all(
      Object.values(parents.relationships).map((r) =>
        this.getRoots(r.target, roots, seen),
      ),
    ).then((roots) => roots.flat());
    return [...retrievedRoots, ...roots];
  }

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

  private async getReleaseTargets(resource: schema.Resource) {
    return db
      .select()
      .from(schema.releaseTarget)
      .innerJoin(
        schema.deployment,
        eq(schema.releaseTarget.deploymentId, schema.deployment.id),
      )
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .where(eq(schema.releaseTarget.resourceId, resource.id))
      .orderBy(schema.system.slug)
      .then((rows) =>
        rows.map((row) => ({
          ...row.release_target,
          deployment: row.deployment,
          system: row.system,
        })),
      );
  }

  private async buildResourceNode(resource: schema.Resource) {
    const releaseTargets = await this.getReleaseTargets(resource);
    const systemsWithReleaseTargets = _.chain(releaseTargets)
      .groupBy((rt) => rt.system.id)
      .map((groupedTargets) => ({
        ...groupedTargets[0]!.system,
        releaseTargets: groupedTargets,
      }))
      .value();
    return { ...resource, systems: systemsWithReleaseTargets };
  }

  async build() {
    const roots = await this.getRoots(this.baseResource, [], new Set());
    this.resources = roots;
    for (const root of roots) await this.getChildren(root);
    const resourceNodes = await Promise.all(
      this.resources.map((r) => this.buildResourceNode(r)),
    );
    return { resources: resourceNodes, edges: this.edges };
  }
}

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
    return new TreeBuilder(baseResource).build();
  });
