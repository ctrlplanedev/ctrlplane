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
            GREATEST(
            similarity(${schema.system.name}, ${search}),
            similarity(${schema.system.description}, ${search}),
            similarity(${schema.system.slug}, ${search})
            ) as rank
        FROM ${schema.system}
        WHERE 
            ${schema.system.workspaceId} = ${workspaceId}
            AND (
            ${schema.system.name} % ${search}
            OR ${schema.system.description} % ${search}
            OR ${schema.system.slug} % ${search}
            )

        UNION ALL

        SELECT 
            'environment' as type,
            ${schema.environment.id} as id,
            ${schema.environment.name} as name,
            ${schema.environment.description} as description,
            '' as "slug",
            GREATEST(
            similarity(${schema.environment.name}, ${search}),
            similarity(${schema.environment.description}, ${search})
            ) as rank
        FROM ${schema.environment}
        INNER JOIN ${schema.system} ON ${schema.environment.systemId} = ${schema.system.id}
        WHERE 
            ${schema.system.workspaceId} = ${workspaceId}
            AND (
            ${schema.environment.name} % ${search}
            OR ${schema.environment.description} % ${search}
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
      }>(query);

      return results.rows;
    }),
});
