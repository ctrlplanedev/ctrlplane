import { sql } from "drizzle-orm";
import { z } from "zod";

import * as schema from "@ctrlplane/db/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const searchRouter = createTRPCRouter({
  search: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        search: z.string(),
        limit: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspaceId, search, limit = 50 } = input;

      await ctx.db.execute(sql`SELECT set_limit(0.1)`);
      const query = sql`
        SELECT 
            'system' as type,
            ${schema.system.id} as id,
            ${schema.system.name} as name,
            ${schema.system.description} as description,
            ${schema.system.slug} as "slug",
            '' as "systemSlug",
            CASE
              WHEN LENGTH(${search}) >= 5 AND ${schema.system.id}::text ~ ${search} THEN 1
              ELSE (
                similarity(${schema.system.name}, ${search}) +
                similarity(${schema.system.description}, ${search}) +
                similarity(${schema.system.slug}, ${search})
              ) / 3
            END as rank
        FROM ${schema.system}
        WHERE 
            ${schema.system.workspaceId} = ${workspaceId}
            AND (
            ${schema.system.name} % ${search}
            OR ${schema.system.description} % ${search}
            OR ${schema.system.slug} % ${search}
            OR LENGTH(${search}) >= 5 AND ${schema.system.id}::text ~ ${search}
            )

        UNION ALL

        SELECT 
            'environment' as type,
            ${schema.environment.id} as id,
            ${schema.environment.name} as name,
            ${schema.environment.description} as description,
            '' as "slug",
            ${schema.system.slug} as "systemSlug",
            CASE
              WHEN LENGTH(${search}) >= 5 AND ${schema.environment.id}::text ~ ${search} THEN 1
              ELSE (
                similarity(${schema.environment.name}, ${search}) +
                similarity(${schema.environment.description}, ${search})
              ) / 2
            END as rank
        FROM ${schema.environment}
        INNER JOIN ${schema.system} ON ${schema.environment.systemId} = ${schema.system.id}
        WHERE 
            ${schema.system.workspaceId} = ${workspaceId}
            AND (
            ${schema.environment.name} % ${search}
            OR ${schema.environment.description} % ${search}
            OR LENGTH(${search}) >= 5 AND ${schema.environment.id}::text ~ ${search}
            )
        
        UNION ALL

        SELECT 
            'resource' as type,
            ${schema.resource.id} as id,
            ${schema.resource.name} as name,
            '' as description,
            ${schema.resource.identifier} as "slug",
            '' as "systemSlug",
            CASE
              WHEN LENGTH(${search}) >= 5 AND ${schema.resource.id}::text ~ ${search} THEN 1
              ELSE (
                similarity(${schema.resource.name}, ${search}) +
                similarity(${schema.resource.identifier}, ${search})
              ) / 2
            END as rank
        FROM ${schema.resource}
        WHERE 
            ${schema.resource.workspaceId} = ${workspaceId}
            AND ${schema.resource.deletedAt} IS NULL
            AND (
            ${schema.resource.name} % ${search}
            OR ${schema.resource.identifier} % ${search}
            OR LENGTH(${search}) >= 5 AND ${schema.resource.id}::text ~ ${search}
            )
        
        UNION ALL

        SELECT 
            'deployment' as type,
            ${schema.deployment.id} as id,
            ${schema.deployment.name} as name,
            ${schema.deployment.description} as description,
            ${schema.deployment.slug} as "slug",
            ${schema.system.slug} as "systemSlug",
            CASE
              WHEN LENGTH(${search}) >= 5 AND ${schema.deployment.id}::text ~ ${search} THEN 1
              ELSE (
                similarity(${schema.deployment.name}, ${search}) +
                similarity(${schema.deployment.description}, ${search}) +
                similarity(${schema.deployment.slug}, ${search})
              ) / 3
            END as rank
        FROM ${schema.deployment}
        INNER JOIN ${schema.system} ON ${schema.deployment.systemId} = ${schema.system.id}
        WHERE 
            ${schema.system.workspaceId} = ${workspaceId}
            AND (
            ${schema.deployment.name} % ${search}
            OR ${schema.deployment.description} % ${search}
            OR ${schema.deployment.slug} % ${search}
            OR LENGTH(${search}) >= 5 AND ${schema.deployment.id}::text ~ ${search}
            )

        ORDER BY rank DESC
        LIMIT ${limit}
      `;

      // Search across multiple tables using raw SQL for full text search
      const results = await ctx.db.execute<{
        type: string;
        id: string;
        name: string;
        description: string;
        slug: string;
        systemSlug?: string;
      }>(query);

      return results.rows;
    }),
});
