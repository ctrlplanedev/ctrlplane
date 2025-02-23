import type { SQL, Tx } from "@ctrlplane/db";
import { add, endOfDay } from "date-fns";
import { z } from "zod";

import {
  and,
  count,
  eq,
  gt,
  isNull,
  lte,
  or,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export type TimeUnit = "days" | "months" | "weeks";

/**
 * Generated a range of dates between two dates by step size.
 */
const dateRange = (start: Date, stop: Date, step: number, unit: TimeUnit) => {
  const dateArray: Date[] = [];
  let currentDate = start;
  while (currentDate <= stop) {
    dateArray.push(currentDate);
    currentDate = add(currentDate, { [unit]: step });
  }
  return dateArray;
};

const getDateRangeCounts = (db: Tx, range: Date[], where?: SQL) =>
  range.map(async (date) => {
    const eod = endOfDay(date);
    const resourceCount = await db
      .select({ count: count().as("count") })
      .from(SCHEMA.resource)
      .where(
        and(
          lte(SCHEMA.resource.createdAt, eod),
          or(
            isNull(SCHEMA.resource.deletedAt),
            gt(SCHEMA.resource.deletedAt, eod),
          ),
          where,
        ),
      )
      .then(takeFirst)
      .then((res) => res.count);

    return { date, count: resourceCount };
  });

export const resourceStatsRouter = createTRPCRouter({
  dailyCount: createTRPCRouter({
    byWorkspaceId: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          startDate: z.date(),
          endDate: z.date(),
        }),
      )
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.WorkspaceGet)
            .on({ type: "workspace", id: input.workspaceId }),
      })
      .query(({ ctx, input }) => {
        const { workspaceId, startDate, endDate } = input;

        const countPromises = getDateRangeCounts(
          ctx.db,
          dateRange(startDate, endDate, 1, "days"),
          eq(SCHEMA.resource.workspaceId, workspaceId),
        );

        return Promise.all(countPromises);
      }),

    byEnvironmentId: protectedProcedure
      .input(
        z.object({
          environmentId: z.string().uuid(),
          startDate: z.date(),
          endDate: z.date(),
        }),
      )
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.EnvironmentGet)
            .on({ type: "environment", id: input.environmentId }),
      })
      .query(async ({ ctx, input }) => {
        const { environmentId, startDate, endDate } = input;

        const environment = await ctx.db
          .select()
          .from(SCHEMA.environment)
          .where(eq(SCHEMA.environment.id, environmentId))
          .then(takeFirstOrNull);

        if (environment == null) throw new Error("Environment not found");

        if (environment.resourceFilter == null) return [];

        const countPromises = getDateRangeCounts(
          ctx.db,
          dateRange(startDate, endDate, 1, "days"),
          SCHEMA.resourceMatchesMetadata(ctx.db, environment.resourceFilter),
        );

        return Promise.all(countPromises);
      }),
  }),
});
