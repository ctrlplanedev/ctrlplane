import { z } from "zod";

import {
  and,
  count,
  eq,
  isNotNull,
  isNull,
  max,
  takeFirst,
} from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

export const healthRouter = createTRPCRouter({
  byWorkspaceId: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceProviderGet)
          .on({ type: "workspace", id: input }),
    })
    .query(async ({ ctx, input }) =>
      ctx.db
        .select({
          total: count(),
          latestSync: max(SCHEMA.resource.updatedAt),
        })
        .from(SCHEMA.resource)
        .where(
          and(
            eq(SCHEMA.resource.workspaceId, input),
            isNotNull(SCHEMA.resource.providerId),
            isNull(SCHEMA.resource.deletedAt),
          ),
        )
        .then(takeFirst),
    ),
});
