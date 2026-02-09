import { z } from "zod";

export const prometheusProviderConfig = z.object({
  type: z.literal("prometheus"),
  address: z.string(),
  query: z.string(),
  timeout: z.number().optional(),
});

export type PrometheusProviderConfig = z.infer<typeof prometheusProviderConfig>;

const prometheusResultEntry = z.object({
  metric: z.record(z.string()).optional(),
  value: z.number(),
});

export const prometheusMeasurementData = z.object({
  ok: z.boolean(),
  statusCode: z.number(),
  duration: z.number().optional(),
  value: z.number().nullable().optional(),
  results: z.array(prometheusResultEntry).nullable().optional(),
  error: z.string().optional(),
  errorType: z.string().optional(),
});

export type PrometheusMeasurementData = z.infer<
  typeof prometheusMeasurementData
>;

export function parsePrometheusProvider(
  provider: unknown,
): PrometheusProviderConfig | null {
  const result = prometheusProviderConfig.safeParse(provider);
  return result.success ? result.data : null;
}

export function parsePrometheusMeasurement(
  data: unknown,
): PrometheusMeasurementData | null {
  const result = prometheusMeasurementData.safeParse(data);
  return result.success ? result.data : null;
}

export function isPrometheusMeasurement(data: unknown): boolean {
  return prometheusMeasurementData.safeParse(data).success;
}

export function isPrometheusProvider(provider: unknown): boolean {
  return prometheusProviderConfig.safeParse(provider).success;
}
