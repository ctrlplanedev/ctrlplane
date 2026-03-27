import { trpc } from "~/api/trpc";

export function useMetricMeasurements(metricId: string) {
  const { data, isLoading } = trpc.verifications.measurements.useQuery(
    metricId,
  );
  return { measurements: data ?? [], isLoading };
}
