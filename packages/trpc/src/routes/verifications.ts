import { z } from "zod";

import { asc, desc, eq, inArray } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import { protectedProcedure, router } from "../trpc.js";

type MeasurementStatus = "failed" | "inconclusive" | "passed";
type JobVerificationStatus = "passed" | "failed" | "running" | "";

function getFailedCount(measurements: MeasurementStatus[]): number {
  return measurements.filter((s) => s === "failed").length;
}

function getConsecutiveSuccessCount(measurements: MeasurementStatus[]): number {
  let i = measurements.length;
  while (i > 0 && measurements[i - 1] === "passed") i--;
  return measurements.length - i;
}

type MeasurementRow = { metricId: string | null; status: MeasurementStatus };

function groupMeasurementsByMetric(
  metricIds: string[],
  measurements: MeasurementRow[],
): Map<string, MeasurementStatus[]> {
  return new Map(
    metricIds.map((id) => [
      id,
      measurements.filter((r) => r.metricId === id).map((r) => r.status),
    ]),
  );
}

function computeMetricPhase(
  measurements: MeasurementStatus[],
  count: number,
  successThreshold: number | null,
  failureThreshold: number | null,
): "passed" | "failed" | "running" {
  const failureLimit = failureThreshold ?? 0;
  const failedCount = getFailedCount(measurements);
  const consecutiveSuccessCount = getConsecutiveSuccessCount(measurements);

  const hasAnyFailures = failedCount > 0;
  const isFailureLimitExceeded = failureLimit > 0 && failedCount > failureLimit;
  if ((failureLimit === 0 && hasAnyFailures) || isFailureLimitExceeded)
    return "failed";

  if (
    successThreshold != null &&
    successThreshold > 0 &&
    consecutiveSuccessCount >= successThreshold
  )
    return "passed";

  if (measurements.length >= count) return "passed";

  return "running";
}

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
    .query(async ({ input, ctx }) => {
      const metrics = await ctx.db
        .select({
          id: schema.jobVerificationMetricStatus.id,
          count: schema.jobVerificationMetricStatus.count,
          successThreshold: schema.jobVerificationMetricStatus.successThreshold,
          failureThreshold: schema.jobVerificationMetricStatus.failureThreshold,
        })
        .from(schema.jobVerificationMetricStatus)
        .where(eq(schema.jobVerificationMetricStatus.jobId, input.jobId));

      if (metrics.length === 0) return { status: "" as JobVerificationStatus };

      const measurements = await ctx.db
        .select({
          metricId:
            schema.jobVerificationMetricMeasurement
              .jobVerificationMetricStatusId,
          status: schema.jobVerificationMetricMeasurement.status,
        })
        .from(schema.jobVerificationMetricMeasurement)
        .where(
          inArray(
            schema.jobVerificationMetricMeasurement
              .jobVerificationMetricStatusId,
            metrics.map((m) => m.id),
          ),
        )
        .orderBy(asc(schema.jobVerificationMetricMeasurement.measuredAt));

      const byMetric = groupMeasurementsByMetric(
        metrics.map((m) => m.id),
        measurements,
      );

      const phases = metrics.map((m) =>
        computeMetricPhase(
          byMetric.get(m.id) ?? [],
          m.count,
          m.successThreshold,
          m.failureThreshold,
        ),
      );

      if (phases.some((p) => p === "failed"))
        return { status: "failed" as JobVerificationStatus };
      if (phases.some((p) => p === "running"))
        return { status: "running" as JobVerificationStatus };
      return { status: "passed" as JobVerificationStatus };
    }),
});
