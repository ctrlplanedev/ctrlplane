import { z } from "zod";

export const datadogProviderConfig = z.object({
  type: z.literal("datadog"),
  queries: z.record(z.string()),
  apiKey: z.string(),
  appKey: z.string(),
  site: z.string().optional(),
  aggregator: z.string().optional(),
  intervalSeconds: z.number().optional(),
  formula: z.string().optional(),
});

export type DatadogProviderConfig = z.infer<typeof datadogProviderConfig>;

const datadogColumn = z.object({
  name: z.string(),
  type: z.string().optional(),
  values: z.array(z.number().nullable()).optional(),
  meta: z
    .object({
      unit: z.unknown().nullable().optional(),
    })
    .optional(),
});

export const datadogMeasurementData = z.object({
  ok: z.boolean(),
  statusCode: z.number(),
  duration: z.number().optional(),
  body: z.string().optional(),
  json: z
    .object({
      data: z
        .object({
          id: z.string().optional(),
          type: z.string().optional(),
          attributes: z
            .object({
              columns: z.array(datadogColumn).optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
  queries: z.record(z.number().nullable()).optional(),
  error: z.string().optional(),
});

export type DatadogMeasurementData = z.infer<typeof datadogMeasurementData>;

export function parseDatadogProvider(
  provider: unknown,
): DatadogProviderConfig | null {
  const result = datadogProviderConfig.safeParse(provider);
  return result.success ? result.data : null;
}

export function parseDatadogMeasurement(
  data: unknown,
): DatadogMeasurementData | null {
  const result = datadogMeasurementData.safeParse(data);
  return result.success ? result.data : null;
}

export function isDatadogProvider(provider: unknown): boolean {
  return datadogProviderConfig.safeParse(provider).success;
}

export function isDatadogMeasurement(data: unknown): boolean {
  return datadogMeasurementData.safeParse(data).success;
}
