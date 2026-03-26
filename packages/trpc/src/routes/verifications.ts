import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { desc, eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

export const verificationsRouter = router({
  measurements: protectedProcedure
    .input(z.uuid())
    .query(async ({ input, ctx }) => {
      return ctx.db
        .select({
          id: schema.jobVerificationMetricMeasurement.id,
          status: schema.jobVerificationMetricMeasurement.status,
          data: schema.jobVerificationMetricMeasurement.data,
          measuredAt: schema.jobVerificationMetricMeasurement.measuredAt,
        })
        .from(schema.jobVerificationMetricMeasurement)
        .where(
          eq(
            schema.jobVerificationMetricMeasurement
              .jobVerificationMetricStatusId,
            input,
          ),
        )
        .orderBy(desc(schema.jobVerificationMetricMeasurement.measuredAt));
    }),

  status: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ input }) => {
      const result = await getClientFor().GET(
        "/v1/jobs/{jobId}/verification-status",
        { params: { path: { jobId: input.jobId } } },
      );

      if (result.error != null) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to get verification status: ${JSON.stringify(result.error)}`,
        });
      }

      return result.data;
    }),
});
