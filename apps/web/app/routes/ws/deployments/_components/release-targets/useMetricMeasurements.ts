import { trpc } from "~/api/trpc";

export function useMetricMeasurements(metricId: string) {
  const { data, isLoading } =
    trpc.verifications.measurements.useQuery(metricId);
  const measurements = (data ?? []).sort(
    (a, b) =>
      new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
  );
  return { measurements, isLoading };
}
