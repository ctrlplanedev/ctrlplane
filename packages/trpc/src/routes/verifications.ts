import { z } from "zod";

import { desc, eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

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
});
