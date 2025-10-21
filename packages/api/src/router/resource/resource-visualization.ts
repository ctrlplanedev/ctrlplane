import _ from "lodash-es";
import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { getResourceChildren, getResourceParents } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure } from "../../trpc";

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
  constructor(private baseResource: schema.Resource) {
    this.resources.push(baseResource);
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

  async getParents(resource: schema.Resource) {
    const parentRelationships = await getResourceParents(db, resource.id);
    const hasParents =
      Object.values(parentRelationships.relationships).length > 0;
    if (!hasParents) return;
    for (const { source, type } of Object.values(
      parentRelationships.relationships,
    )) {
      this.addEdge(source.id, resource.id, type);
      this.resources.push(source);
      await this.getParents(source);
    }
  }

  private async getChildren(resource: schema.Resource) {
    const resourceChildren = await getResourceChildren(db, resource.id);
    if (resourceChildren.length === 0) return;
    for (const { target, type } of resourceChildren) {
      this.addEdge(resource.id, target.id, type);
      this.resources.push(target);
      await this.getChildren(target);
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
    await this.getParents(this.baseResource);
    await this.getChildren(this.baseResource);
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
